import express from 'express'

export class WebServer {
    constructor(competition, discordClient) {
        const app = express()
        const port = 3000

        app.get('/scores', async (req, res) => {
            await competition.getScores(async scores => {
                for (const score in scores) scores[score]['display_name'] = await discordClient.getUserName(scores[score]['display_name']);
                res.send(scores);
            });
        });

        app.use(express.static('public'))

        app.listen(port, () => {
            console.log(`Example app listening at http://localhost:${port}`)
        });
    }
}