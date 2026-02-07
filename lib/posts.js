import sql from 'better-sqlite3';
import slugify from 'slugify';

const db = new sql('posts.db');

function initDb() {
  // Create tables if not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      post_id INTEGER, -- Assuming a post_id for blog details
      parent_id INTEGER DEFAULT NULL, -- NULL for top-level comments, references id for replies
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      avatar_url TEXT DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES comments(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      username TEXT,
      points INTEGER DEFAULT 0
    )
  `);
  
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY, 
      image_url TEXT NOT NULL,
      title TEXT NOT NULL, 
      slug TEXT UNIQUE,                -- ✅ Include slug here for new dbs
      content TEXT NOT NULL, 
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER, 
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER, 
      post_id INTEGER, 
      PRIMARY KEY(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, 
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    )`);

  // ✅ Check if slug column already exists
  const pragma = db.prepare(`PRAGMA table_info(posts)`).all();
  const hasSlug = pragma.some((col) => col.name === 'slug');
  if (!hasSlug) {
    console.log('🛠 Adding missing slug column...');
    db.exec(`ALTER TABLE posts ADD COLUMN slug TEXT UNIQUE`);
  }

  // ✅ Check and add username column if missing
  const userPragma = db.prepare(`PRAGMA table_info(users)`).all();
  const hasUsername = userPragma.some((col) => col.name === 'username');
  const hasPoints = userPragma.some(col => col.name === 'points');
  const hasAvatar = userPragma.some(col => col.name === 'avatar_url');
  const commentPragma = db.prepare(`PRAGMA table_info(comments)`).all();
  const hasParentId = commentPragma.some(col => col.name === 'parent_comment_id');
  const hasAvatar2 = commentPragma.some(col => col.name === 'avatar_url');
  if (!hasUsername) {
    console.log('🛠 Adding missing username column to users...');
    db.exec(`ALTER TABLE users ADD COLUMN username TEXT`);
  }
  if (!hasPoints) {
    console.log("🛠 Adding 'points' column to existing users table...");
    db.exec(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0`);
  }
  if(!hasAvatar){
    console.log("🛠 Adding 'avatar_url' column to users...");
    db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
  }
  if (!hasParentId) {
    console.log("🛠 Adding 'parent_comment_id' column to comments...");
    db.exec(`ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER`);
  }
  if(!hasAvatar2){
    console.log("🛠 Adding 'avatar_url' column to comments...");
    db.exec(`ALTER TABLE comments ADD COLUMN avatar_url TEXT`);
  }
}

initDb();

export async function getPosts(maxNumber) {
  let limitClause = '';

  if (maxNumber) {
    limitClause = 'LIMIT ?';
  }

  const stmt = db.prepare(`
    SELECT posts.id, image_url AS image, title, slug, content, created_at AS createdAt, users.username AS username, COUNT(likes.post_id) AS likes, EXISTS(SELECT * FROM likes WHERE likes.post_id = posts.id and likes.user_id = 2) AS isLiked
    FROM posts
    INNER JOIN users ON posts.user_id = users.id
    LEFT JOIN likes ON posts.id = likes.post_id
    GROUP BY posts.id
    ORDER BY createdAt DESC
    ${limitClause}`);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return maxNumber ? stmt.all(maxNumber) : stmt.all();
}

export async function storePost(post) {
  const slug = slugify(post.title);
  const stmt = db.prepare(`
    INSERT INTO posts (image_url, title, slug, content, user_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return stmt.run(post.imageUrl, post.title, slug, post.content, post.userId);
}

export async function updatePostLikeStatus(postId, userId) {
  const stmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM likes
    WHERE user_id = ? AND post_id = ?`);

  const isLiked = stmt.get(userId, postId).count === 0;

  if (isLiked) {
    const stmt = db.prepare(`
      INSERT INTO likes (user_id, post_id)
      VALUES (?, ?)`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return stmt.run(userId, postId);
  } else {
    const stmt = db.prepare(`
      DELETE FROM likes
      WHERE user_id = ? AND post_id = ?`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return stmt.run(userId, postId);
  }
}

export async function getPostBySlug(slug) {
  const stmt = db.prepare(`
    SELECT 
      posts.id,
      posts.image_url AS image,  -- 👈 ALIAS it to 'image'
      posts.title,
      posts.content,
      posts.created_at AS createdAt,
      posts.slug,
      users.username AS username
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE slug = ?
  `);
  return stmt.get(slug.trim());
}

export async function getCommentsForPost(postId) {
  const stmt = db.prepare(`
    SELECT content, created_at
    FROM comments
    WHERE post_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(postId);
}

export async function addComment({ postId, userId, content }) {
  const stmt = db.prepare(`
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `);
  return stmt.run(postId, userId, content);
}
