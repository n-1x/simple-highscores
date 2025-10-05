const http = require("http");
const fs = require("fs");

const MAX_NAME_LENGTH = 12;
const NUM_HIGH_SCORES = 10;
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

let highScores = {};

function loadHighScores() {
  fs.readFile("highScores.json", (err, data) => {
    if (err) {
      console.log("./highscores.json not found.");
    } else {
      highScores = JSON.parse(data);
      console.log("./highscores.json loaded");
    }
  });
}


function updateHighScores(obj) {
  const sortFunc = (a, b) => {
    if (b.score === a.score) {
      return b.submitTime > a.submitTime ? 1 : -1;
    }
    else {
      return b.score > a.score ? 1 : -1;
    }
  };
  
  let {name, score, game} = obj;
  
  // add / update submit time
  obj["submitTime"] = (new Date()).getTime().toString();
  
  const leaderboard = highScores[game] || [];
  
  if (leaderboard.length === 0) {
    console.log("New game added: " + game);
  }
  
  if (name.length > MAX_NAME_LENGTH)
  {
      name = name.substring(0, MAX_NAME_LENGTH);
  }
  
  let alreadyOnLeaderboard = false;

  for (let i = 0; i < leaderboard.length; ++i) {
    const entry = leaderboard[i];
    
    if (entry.name.toLowerCase() === name.toLowerCase()) {
      const higherScore = score > entry.score ? score : entry.score;
      
      alreadyOnLeaderboard = true;
      obj.score = higherScore;
      leaderboard[i] = obj;
      break;
    }
  }
  
  if (!alreadyOnLeaderboard) {
    leaderboard.push(obj);
  }
  
  highScores[game] = leaderboard.sort(sortFunc).slice(0, NUM_HIGH_SCORES);
  
  console.log("High scores updated");
  console.log(highScores[game]);
}

function handleHead(req, res, params) {
  res.writeHead(200);
  res.end();
}

function handleGet(req, res, params) {
  const gameName = params.get("game");
  const leaderboard = highScores[gameName] || [];
  
  res.writeHead(200, headers);
  res.write(JSON.stringify(leaderboard));
  res.end();
}


function handlePut(req, res, params) {
  const obj = {};
  
  for (const [name, value] of params.entries()) {
    obj[name] = value;
  }

  if (obj.game != undefined && obj.score != undefined && obj.name != undefined && obj.name.length > 0) {
    updateHighScores(obj);

    res.writeHead(200, headers);
    res.write(JSON.stringify(highScores));
    res.end();

    fs.writeFile("highScores.json", JSON.stringify(highScores, null, 2), err => {
      if (err) {
        console.log("Couldn't save high scores to file");
      } else {
        console.log("Scores backed up.");
      }
    });
  } 
  else {
    res.writeHead(400, headers);
    res.write("Invalid parameters");
    res.end();
  }
}

function handleDelete(req, res, params) {
  const gameName = params.get("game");
  delete highScores[gameName];
}

function deleteExpiredDailyScores() {
  for (const game in highScores) {
    highScores[game] = highScores[game].filter(score => {
      let shouldKeep = true;
      
      if (score.daily) {
        const now = new Date();
        const submitDate = new Date(parseInt(score.submitTime));
        const scoreSubmittedToday = now.getDate() === submitDate.getDate()
          && now.getMonth() === submitDate.getMonth() 
          && now.getFullYear() === submitDate.getFullYear();
        
        shouldKeep = scoreSubmittedToday;
      }
      
      if (!shouldKeep) {
        console.log("deleting score");
        console.log(score);
      }
      
      return shouldKeep;
    });
  }
}


const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  const params = new URLSearchParams(req.url.split("?")[1]);
  
  deleteExpiredDailyScores();

  switch (req.method) {
    case "HEAD":
      handleHead(req, res, params);
      break;

    case "GET":
      handleGet(req, res, params);
      break;

    case "PUT":
      handlePut(req, res, params);
      break;

    case "OPTIONS":
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS, DELETE"
      });
      res.end();
      break;
      
    case "DELETE":
      handleDelete(req, res, params);
      break;

    default:
      res.statusCode = 400;
  }
});

loadHighScores();
server.listen(8081);
console.log("Listening");
