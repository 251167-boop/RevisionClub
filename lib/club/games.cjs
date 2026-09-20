const { randomInt } = require("node:crypto");
const { normalize, MATH_GAME_TOPICS } = require("./rules.cjs");
const GAME_TOPICS = {
  "Math Rush": MATH_GAME_TOPICS,
  "Boss Battle": MATH_GAME_TOPICS,
  Timeline: ["World history", "Chinese history", "Hong Kong history"],
  "Keyword Blitz": ["Integrated Science", "Geography", "ICT", "History"],
  "True or Trap": ["ICT", "Integrated Science", "Geography"],
  "Diagram Dash": ["Water cycle"],
};
const GAMES = [
  {
    name: "Math Rush",
    icon: "ϟ",
    subject: "Maths",
    description:
      "Ten multiplication questions. Build speed without losing accuracy.",
  },
  {
    name: "Timeline",
    icon: "↔",
    subject: "History",
    description:
      "Put historical events in order. Use the arrows or drag the event cards.",
  },
  {
    name: "Keyword Blitz",
    icon: "◈",
    subject: "Integrated Science",
    description: "Match essential science terms with their definitions.",
  },
  {
    name: "True or Trap",
    icon: "◐",
    subject: "ICT",
    description: "Read carefully. Decide which computing statements are true.",
  },
  {
    name: "Diagram Dash",
    icon: "◎",
    subject: "Geography",
    description: "Follow the water-cycle diagram and identify each process.",
  },
  {
    name: "Boss Battle",
    icon: "♜",
    subject: "Maths",
    description:
      "Each correct answer deals damage. Defeat the boss with accurate maths.",
  },
];
const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function makeGame(name, selectedTopic = null) {
  const game = GAMES.find((g) => g.name === name);
  if (!game) throw new Error("Game unavailable.");
  if (selectedTopic && !GAME_TOPICS[name].includes(selectedTopic))
    throw new Error(
      ["Math Rush", "Boss Battle"].includes(name)
        ? "Choose an available maths topic."
        : "Choose an available topic.",
    );
  const topic = selectedTopic || GAME_TOPICS[name][0];
  let questions;
  if (["Math Rush", "Boss Battle"].includes(name))
    questions = Array.from({ length: 10 }, (_, i) => {
      const a = randomInt(2, 20),
        b = randomInt(2, 15);
      if (topic === "Fractions") {
        const numerator = randomInt(1, a);
        return {
          id: String(i + 1),
          text: `What is ${numerator}/${a} of ${a * b}?`,
          answer: String(numerator * b),
          type: "number",
          topic,
        };
      }
      if (topic === "Linear equations") {
        const x = randomInt(-9, 20);
        return {
          id: String(i + 1),
          text: `Find x: ${a}x + ${b} = ${a * x + b}`,
          answer: String(x),
          type: "number",
          topic,
        };
      }
      return {
        id: String(i + 1),
        text: `${a} × ${b}`,
        answer: String(a * b),
        type: "number",
        topic,
      };
    });
  if (name === "Timeline") {
    const eventSets = {
      "World history": [
      ["Printing of the Gutenberg Bible", 1455],
      ["Beginning of the French Revolution", 1789],
      ["Start of the First World War", 1914],
      ["End of the First World War", 1918],
      ["Start of the Second World War in Europe", 1939],
      ["United Nations founded", 1945],
      ],
      "Chinese history": [
        ["Qin dynasty unifies China", -221],
        ["Han dynasty begins", -202],
        ["Tang dynasty begins", 618],
        ["Song dynasty begins", 960],
        ["Ming dynasty begins", 1368],
        ["Qing dynasty begins", 1644],
      ],
      "Hong Kong history": [
        ["Hong Kong Island ceded to Britain", 1842],
        ["Kowloon Peninsula ceded", 1860],
        ["New Territories leased", 1898],
        ["Japanese occupation begins", 1941],
        ["Japanese occupation ends", 1945],
        ["Hong Kong returns to China", 1997],
      ],
    };
    const events = eventSets[topic];
    const order = events.map((e, i) => String(i));
    questions = [
      {
        id: "1",
        text: "Order these events from earliest to latest.",
        type: "timeline",
        events: shuffle(events.map(([text], i) => ({ id: String(i), text }))),
        answer: order.join(","),
        explanation: events
          .map(([event, year]) => `${year}: ${event}`)
          .join("\n"),
      },
    ];
  }
  if (name === "Keyword Blitz") {
    const termSets = {
      "Integrated Science": [
      ["Evaporation", "Liquid changing into a gas at its surface."],
      ["Condensation", "Gas changing into a liquid."],
      ["Melting", "A solid changing into a liquid."],
      ["Freezing", "A liquid changing into a solid."],
      ["Gravity", "The attractive force between masses."],
      [
        "Photosynthesis",
        "The process by which plants use light energy to make sugars.",
      ],
      [
        "Conductor",
        "A material that allows electric current to pass through easily.",
      ],
      ["Insulator", "A material that strongly resists electric current."],
      ],
      Geography: [
        ["Weather", "Atmospheric conditions over a short period."],
        ["Climate", "The long-term pattern of weather in a place."],
        ["Erosion", "The wearing away and movement of rock or soil."],
        ["Deposition", "The laying down of transported material."],
        ["Urbanisation", "Growth in the proportion of people living in towns and cities."],
        ["Population density", "The number of people living per unit area."],
        ["Renewable", "A resource replenished naturally on a human timescale."],
        ["Sustainability", "Meeting present needs without preventing future needs being met."],
      ],
      ICT: [
        ["Algorithm", "A precise sequence of steps used to solve a problem."],
        ["Variable", "A named place used to store a value."],
        ["Encryption", "Transforming information so only authorised users can read it."],
        ["Phishing", "A deceptive attempt to obtain sensitive information."],
        ["RAM", "Temporary working memory used by running programs."],
        ["CPU", "The component that executes program instructions."],
        ["Database", "An organised collection of structured data."],
        ["Network", "Connected devices that exchange data and resources."],
      ],
      History: [
        ["Primary source", "Evidence created during the period being studied."],
        ["Secondary source", "An interpretation produced after the period studied."],
        ["Chronology", "The arrangement of events in time order."],
        ["Cause", "A factor that helps an event happen."],
        ["Consequence", "A result or effect of an event."],
        ["Continuity", "An aspect that remains similar across time."],
        ["Change", "A significant difference across time."],
        ["Bias", "A preference that can shape how evidence is presented."],
      ],
    };
    const terms = termSets[topic];
    questions = shuffle(terms).map(([answer, text], i) => ({
      id: String(i + 1),
      text,
      type: "choice",
      answer,
      options: shuffle([
        answer,
        ...shuffle(terms.map((x) => x[0]).filter((x) => x !== answer)).slice(
          0,
          3,
        ),
      ]),
    }));
  }
  if (name === "True or Trap") {
    const statementSets = {
      ICT: [
      ["A bit can have one of two values, 0 or 1.", true],
      ["RAM normally retains its contents when the power is off.", false],
      ["A strong unique password helps protect an account.", true],
      ["A phishing message may impersonate someone you trust.", true],
      ["An operating system manages computer hardware resources.", true],
      ["A URL and an email address are always the same thing.", false],
      ["A backup is a separate copy of data for recovery.", true],
      ["Every website using HTTPS is guaranteed to be trustworthy.", false],
      ["A byte consists of eight bits.", true],
      ["Deleting a shortcut always deletes the original file.", false],
      ],
      "Integrated Science": [
        ["Plants require light for photosynthesis.", true],
        ["All metals are magnetic.", false],
        ["Sound requires a medium through which to travel.", true],
        ["Mass and weight always mean exactly the same thing.", false],
        ["Cells are the basic units of living organisms.", true],
        ["Pure water boils at 100°C at standard atmospheric pressure.", true],
        ["An insulator allows electric current to pass easily.", false],
        ["Forces can change an object's speed or direction.", true],
        ["The Moon produces its own visible light.", false],
        ["Evaporation can occur below boiling point.", true],
      ],
      Geography: [
        ["Weather describes short-term atmospheric conditions.", true],
        ["Climate is measured using only one day of data.", false],
        ["Rivers can erode, transport and deposit material.", true],
        ["All renewable resources have no environmental impact.", false],
        ["Population density compares population with land area.", true],
        ["Urbanisation means a falling urban population share.", false],
        ["Contour lines join places of equal elevation.", true],
        ["A map scale links map distance to real distance.", true],
        ["Longitude measures distance north or south of the Equator.", false],
        ["Sustainability considers future generations.", true],
      ],
    };
    const statements = statementSets[topic];
    questions = shuffle(statements).map(([text, truth], i) => ({
      id: String(i + 1),
      text,
      type: "choice",
      answer: truth ? "True" : "False",
      options: ["True", "False"],
    }));
  }
  if (name === "Diagram Dash") {
    const labels = [
      ["A", "Evaporation"],
      ["B", "Condensation"],
      ["C", "Precipitation"],
      ["D", "Collection"],
    ];
    questions = labels.map(([label, answer], i) => ({
      id: String(i + 1),
      text: `Which process is shown at ${label}?`,
      type: "diagram",
      label,
      answer,
      options: labels.map((x) => x[1]),
    }));
  }
  return { ...game, topic, questions };
}
function gradeGame(game, answers) {
  const qs = JSON.parse(game.questions);
  const items = qs.map((q) => {
    let correct = normalize(answers[q.id]) === normalize(q.answer);
    return {
      id: q.id,
      text: q.text,
      correct,
      answer: q.answer,
      explanation: q.explanation || "",
      studentAnswer: String(answers[q.id] || ""),
    };
  });
  return {
    items,
    correct: items.filter((x) => x.correct).length,
    total: items.length,
  };
}
module.exports = { GAMES, GAME_TOPICS, makeGame, gradeGame };
