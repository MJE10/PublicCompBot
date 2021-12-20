// node --experimental-json-modules .

import { Competition } from './js/compFunctions.js';
import { DiscordClient } from './js/discordClient.js';
import { WebServer } from './js/server.js';
import mysql from 'mysql';

var connection = mysql.createConnection({
  host: '',
  user: '',
  password: '',
  database: ''
});

connection.connect(err => {
  const competition = new Competition(connection);
  const discordClient = new DiscordClient(connection, competition);
  const webServer = new WebServer(competition, discordClient);
});

async function query(connection, query) {
  let myresult = undefined;
  await connection.query(query, (err, result, fields) => {
    if (err) {
      console.log(err);
    }
    console.log(result);
    myresult = result;
  });
  return myresult;
}

// connection.destroy()

// https://www.npmjs.com/package/mysql