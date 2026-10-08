import { readJSON } from "@/lib/club/request-body.mjs";
import { assertSameOrigin } from "@/lib/club/security";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { mysqlDashboard } from "@/lib/club/mysql-dashboard";
import {
  deleteMysqlVersionDraft,
  mysqlFileUsage,
  mysqlFiles,
  saveMysqlFileExtracted,
  mysqlPaperDraft,
  mysqlVisualAsset,
  mysqlVisualAssetPaperIds,
  mysqlVersionDraft,
  mysqlVersionEditContext,
  saveMysqlFile,
  saveMysqlPaperDraft,
  saveMysqlVersionDraft,
} from "@/lib/club/mysql-drafts";
import { extractPdfText } from "@/lib/club/upload-file.mjs";
import domain from "@/lib/club/service.cjs";
import mysqlSync from "@/lib/club/mysql-sync.cjs";
import rules from "@/lib/club/rules.cjs";
import {
  generatePaper,
  regenerateQuestions,
  markPaper,
  aiAvailable,
} from "@/lib/club/ai.mjs";
import { generateQuestionImage } from "@/lib/club/image-generation.mjs";
import visualPolicy from "@/lib/club/visual-policy.cjs";
import { randomUUID } from "node:crypto";
import games from "@/lib/club/games.cjs";
const { validateVisualPlan } = visualPolicy;
export const dynamic = "force-dynamic";
let mysqlServiceInstance;
function mysqlService() {
  if (!mysqlPool)
    throw new Error("MySQL is required. SQLite fallback has been removed.");
  if (!mysqlServiceInstance)
    mysqlServiceInstance = domain.service(mysqlSync.openMysqlSync());
  return mysqlServiceInstance;
}

async function ownedFiles(userId, ids) {
  const uniqueIds = [...new Set((ids || []).map(String))];
  if (!uniqueIds.length) return [];
  const files = await mysqlFiles(userId, uniqueIds);
  if (files.length !== uniqueIds.length) throw new Error("File access denied.");
  await Promise.all(
    files.map(async (file) => {
      if (file.extracted || file.mime !== "application/pdf") return;
      const extracted = await extractPdfText(Buffer.from(file.content));
      if (!extracted) return;
      file.extracted = extracted;
      await saveMysqlFileExtracted(userId, file.id, extracted);
    }),
  );
  return files;
}
function visualAssetIds(content) {
  return (content?.questions || [])
    .map((question) => question.visual?.assetId)
    .filter(Boolean)
    .map(String);
}
const throttle = globalThis.__clubThrottle || new Map();
globalThis.__clubThrottle = throttle;
function rate(uid, path) {
  const key = uid + ":" + path,
    old = throttle.get(key);
  if (old && Date.now() - old < 1500)
    throw new Error("Please wait a moment before trying again.");
  throttle.set(key, Date.now());
  if (throttle.size > 10000) throttle.clear();
}
async function identity(request, write = false) {
  const { user } = await verifyAuth();
  if (!user) throw new Error("Sign in required.");
  if (write) {
    assertSameOrigin(request);
  }
  return user;
}
export async function GET(request, props) {
  const params = await props.params;
  try {
    const user = await identity(request),
      uid = user.id,
      [resource, key] = params.path;
    let data;
    const q = new URL(request.url).searchParams;
    if (resource === "visual-asset") {
      const asset = await mysqlVisualAsset(key);
      if (!asset)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      let allowed = Number(asset.owner_id) === Number(uid);
      if (!allowed) {
        const paperIds = await mysqlVisualAssetPaperIds(key);
        for (const paperId of paperIds) {
          try {
            mysqlService().paper(uid, paperId);
            allowed = true;
            break;
          } catch {}
        }
      }
      if (!allowed) throw new Error("Figure access denied.");
      return new NextResponse(Buffer.from(asset.content), {
        headers: {
          "Content-Type": asset.mime,
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (resource === "dashboard")
      data = { ...(await mysqlDashboard(uid)), user, ai: aiAvailable() };
    else if (resource === "papers") {
      const svc = mysqlService();
      data = key
        ? svc.paper(uid, key)
        : q.get("page")
          ? svc.paperPage(
              uid,
              q.get("community") === "true",
              q.get("page"),
              q.get("pageSize"),
              {
                query: q.get("q"),
                subject: q.get("subject"),
                difficulty: q.get("difficulty"),
                grade: q.get("grade"),
                sort: q.get("sort"),
              },
            )
          : svc.papers(uid, q.get("community") === "true");
    } else {
      const svc = mysqlService();
      if (resource === "attempts") data = svc.attempt(uid, key);
      else if (resource === "results")
        data = key ? svc.review(uid, key) : svc.results(uid);
      else if (resource === "groups")
        data = key ? svc.group(uid, key) : svc.groups(uid);
      else if (resource === "paper-draft")
        data = await mysqlPaperDraft(uid, q.get("group") || "");
      else if (resource === "version-draft")
        data = await mysqlVersionDraft(uid, key);
      else if (resource === "assignments") data = svc.assignments(uid);
      else if (resource === "friends") data = svc.friends(uid);
      else if (resource === "mistakes") data = svc.mistakes(uid);
      else if (resource === "progress") data = svc.progressHistory(uid);
      else if (resource === "search") data = svc.globalSearch(uid, q.get("q"));
      else if (resource === "challenges") data = svc.battles(uid);
      else if (resource === "challenge-opponents")
        data = svc.challengeOpponents(uid);
      else if (resource === "leaderboard")
        data = svc.leaderboard(
          uid,
          q.get("scope"),
          q.get("range"),
          q.get("category"),
        );
      else if (resource === "profile")
        data = {
          ...svc.stats(uid),
          profile:
            svc.get(
              "SELECT school,bio FROM rc_profiles WHERE user_id=?",
              uid,
            ) || {},
          user: svc.get(
            "SELECT username,avatar_url FROM users WHERE id=?",
            uid,
          ),
          preferences: svc.get(
            "SELECT study_reminders,social_updates,achievement_updates FROM rc_notification_preferences WHERE user_id=?",
            uid,
          ) || {
            study_reminders: 1,
            social_updates: 1,
            achievement_updates: 1,
          },
          achievements: svc.all(
            "SELECT * FROM rc_achievements WHERE user_id=?",
            uid,
          ),
        };
      else if (resource === "messages") {
        data = svc.messages(uid, {
          groupId: q.get("group") || null,
          friendId: key,
          before: q.get("before"),
          limit: q.get("limit"),
        });
      } else return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message === "Sign in required." ? 401 : 403 },
    );
  }
}
export async function POST(request, props) {
  const params = await props.params;
  const reference = randomUUID().slice(0, 8);
  let resource = params.path[0];
  try {
    const user = await identity(request, true),
      uid = user.id,
      key = params.path[1];
    const svc = mysqlService();
    const b = await readJSON(request);
    let data;
    if (resource === "version-regenerate") {
      rate(uid, "generate");
      const context = await mysqlVersionEditContext(uid, key);
      data = await regenerateQuestions(
        context.settings,
        context.files,
        {
          content: b.content || context.content,
          answerKey: b.answerKey || context.answerKey,
        },
        b.questionIds,
      );
      const draft = {
        content: data,
        answerKey: data.answerKey,
        keySource: "AI-generated marking scheme",
      };
      await saveMysqlVersionDraft(uid, key, draft);
    } else if (resource === "generate-image") {
      rate(uid, "image");
      rules.validSubject(b.subject);
      const visual = validateVisualPlan(b.visual, b.subject, b.questionId);
      if (!visual || visual.strategy !== "generated_image")
        throw new Error(
          "This question is not configured for AI image generation.",
        );
      const generated = await generateQuestionImage({
        subject: b.subject,
        questionText: b.questionText,
        visual,
      });
      const id = randomUUID();
      const extension =
        generated.mime === "image/jpeg"
          ? "jpg"
          : generated.mime === "image/webp"
            ? "webp"
            : "png";
      const totalUsage = await mysqlFileUsage(uid);
      if (totalUsage + generated.buffer.length > 100 * 1024 * 1024)
        throw new Error("Upload allowance of 100 MB reached.");
      await saveMysqlFile({
        id,
        owner_id: uid,
        name: `question-${String(b.questionId || "figure").slice(0, 30)}.${extension}`,
        purpose: "Generated Figure",
        mime: generated.mime,
        content: generated.buffer,
        extracted: "",
        created_at: new Date().toISOString(),
      });
      data = validateVisualPlan(
        {
          ...visual,
          assetId: id,
          assetMime: generated.mime,
          generatedAt: new Date().toISOString(),
        },
        b.subject,
        b.questionId,
      );
    } else if (resource === "version-draft")
      data = await saveMysqlVersionDraft(uid, key, b);
    else if (resource === "generate" || resource === "regenerate") {
      rate(uid, "generate");
      rules.validSubject(b.subject);
      if (b.groupId) svc.groupSubject(uid, b.groupId, b.subject);
      const ids = b.fileIds || [];
      if (ids.length > 8) throw new Error("Use up to 8 files.");
      const files = await ownedFiles(uid, ids);
      data =
        resource === "regenerate"
          ? await regenerateQuestions(
              b,
              files,
              { content: b.content, answerKey: b.answerKey },
              b.questionIds,
            )
          : await generatePaper(b, files);
      const draft = {
        settings: { ...b, title: b.title || data.title },
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          purpose: f.purpose,
        })),
        content: data,
        answerKey: data.answerKey,
        keySource: "AI-generated marking scheme",
      };
      await saveMysqlPaperDraft(uid, b.groupId || "", draft);
    } else if (resource === "paper-draft")
      data = await saveMysqlPaperDraft(uid, b.groupId || "", b.draft);
    else if (resource === "papers") {
      const previousFiles = b.sourceVersionId
        ? (await mysqlVersionEditContext(uid, b.sourceVersionId)).files.map(
            (file) => String(file.id),
          )
        : [];
      const fileIds = [
        ...new Set([
          ...(b.fileIds || []).map(String),
          ...previousFiles,
          ...visualAssetIds(b.content),
        ]),
      ];
      await ownedFiles(uid, fileIds);
      data = svc.savePaper(
        uid,
        { ...b, fileIds },
        b.content,
        b.answerKey,
        b.keySource || "Human-provided answer key",
      );
      if (!b.paperId) await saveMysqlPaperDraft(uid, b.groupId || "", null);
      if (b.sourceVersionId)
        await deleteMysqlVersionDraft(uid, b.sourceVersionId);
    } else if (resource === "attempts")
      data = svc.startAttempt(uid, b.versionId, b.assignmentId || null);
    else if (resource === "answers")
      data = svc.saveAnswers(uid, key, b.answers);
    else if (resource === "submit") {
      rate(uid, "submit");
      const c = svc.markingContext(uid, key);
      const clean = svc.saveAnswers(uid, key, b.answers);
      const marked = await markPaper(c, clean);
      data = svc.finishSubmission(uid, key, clean, marked.items, marked.source);
    } else if (resource === "challenge")
      data = svc.challenge(uid, b.itemId, b.reason);
    else if (resource === "resolve")
      data = svc.resolve(
        uid,
        b.challengeId,
        b.mark,
        b.reason,
        b.confirmReduction,
      );
    else if (resource === "gameStart") {
      rate(uid, "game");
      const game = b.versionId
        ? svc.revisionGame(uid, b.versionId)
        : games.makeGame(b.game, b.topic);
      const gid = randomUUID();
      svc.run(
        "INSERT INTO rc_games(id,user_id,game,subject,questions,started_at) VALUES(?,?,?,?,?,?)",
        gid,
        uid,
        game.name,
        game.subject,
        JSON.stringify(game.questions),
        new Date().toISOString(),
      );
      data = {
        id: gid,
        name: game.name,
        topic: game.topic,
        questions: game.questions.map(({ answer, explanation, ...q }) => q),
      };
    } else if (resource === "bossAnswer") {
      data = svc.bossAnswer(uid, b.id, b.questionId, b.answer);
    } else if (resource === "gameFinish") {
      data = svc.transaction(() => {
        const g = svc.get(
          "SELECT * FROM rc_games WHERE id=? AND user_id=?",
          b.id,
          uid,
        );
        if (!g || g.finished_at)
          throw new Error("Game already completed or unavailable.");
        const elapsed = Math.floor(
          (Date.now() - Date.parse(g.started_at)) / 1000,
        );
        if (elapsed < 10 || elapsed > 180)
          throw new Error("Game timing is invalid. Start a new game.");
        let answers = b.answers || {};
        if (g.game === "Boss Battle") {
          const state = svc.bossState(uid, g.id);
          if (!state.complete)
            throw new Error("Finish your boss battle before saving the round.");
          answers = Object.fromEntries(
            state.answers.map((a) => [a.question_id, a.answer]),
          );
        }
        const result = games.gradeGame(g, answers);
        svc.run(
          "UPDATE rc_games SET correct=?,total=?,elapsed=?,finished_at=? WHERE id=?",
          result.correct,
          result.total,
          elapsed,
          new Date().toISOString(),
          g.id,
        );
        const before = svc.stats(uid).xp;
        if (result.correct / result.total >= 0.5)
          svc.xp(uid, "minigame", new Date().toISOString().slice(0, 10));
        svc.achievements(uid);
        return {
          ...result,
          elapsed,
          xpEarned: svc.stats(uid).xp - before,
          best: svc.get(
            "SELECT MAX(correct*100.0/total) best FROM rc_games WHERE user_id=? AND game=?",
            uid,
            g.game,
          ).best,
        };
      })();
    } else if (resource === "action") data = svc.mutate(uid, b.action, b);
    else return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    const status =
      e.httpStatus || (e.message === "Sign in required." ? 401 : 400);
    console.error(
      "Club request failed " +
        JSON.stringify({
          reference,
          resource,
          code: e.publicCode || e.name || "REQUEST_FAILED",
          status,
          upstreamStatus: e.upstreamStatus || null,
          providerStatus: e.providerStatus || null,
          providerRequestId: e.requestId || null,
          retryable: Boolean(e.retryable),
          attempts: e.attempts || 1,
          networkCodes: e.networkCodes || [],
          provider: e.provider || null,
          providerFailures: e.providerFailures || [],
        }),
    );
    return NextResponse.json(
      {
        error: [
          "ER_DUP_ENTRY",
          "ER_NO_REFERENCED_ROW_2",
          "ER_ROW_IS_REFERENCED_2",
        ].includes(e.code)
          ? "This action conflicts with an existing record. Refresh and try again."
          : e.message,
        code: e.publicCode || undefined,
        retryable: Boolean(e.retryable),
        reference: e.publicCode ? reference : undefined,
      },
      { status },
    );
  }
}
