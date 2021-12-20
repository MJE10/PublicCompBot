import generateScramble from 'scramble-generator';
import { makeScrambleImage } from './drawCube.js';

// todo 2d maps

export class Competition {
    constructor(connection) {
        this.clients = {};

        this.DB = {
            connection: connection,
            TABLES: {
                AVERAGES: "averages",
                COMPETITIONS: "competitions",
                CUPS: "cups",
                GLOBALS: "globals",
                JUDGES: "judges",
                PEOPLE: "people",
                SCRAMBLE_SETS: "scramble_sets",
                SCRAMBLES: "scrambles",
                SOLVES: "solves"
            },
            AVERAGES: {
                ID: "id",
                COMPETITION: "competition",
                COMPETITOR: "competitor",
                SCRAMBLE_SET: "scramble_set",
                CUP: "cup",
                SCRAMBLE_NUMBER: "scramble_number",
                MAX_SOLVES: "max_solves"
            },
            COMPETITIONS: {
                ID: "id",
                CREATED_AT: "created_at"
            },
            CUPS: {
                ID: "id",
                NUMBER: "number",
                STATUS: "status",
                AVERAGE: "average",
                SOLVE: "solve",
                STATUSES: {
                    NO_TYPE: "no_type",
                    ADMIN: "admin",
                    AWAITING_CUP: "awaiting_cup",
                    AWAITING_SCRAMBLER: "awaiting_scrambler",
                    AWAITING_RUNNER: "awaiting_runner",
                    AWAITING_JUDGE: "awaiting_judge",
                    SCRAMBLING: "scrambling",
                    RUNNING: "running",
                    JUDGING: "judging"
                }
            },
            GLOBALS: {
                ID: "id",
                NAME: "name",
                VALUE: "value",
                VALUE_STRING: "value_string",
                NAMES: {
                    COMPETITION: "competition",
                    TOKEN: "token",
                    CLIENT_ID: "clientId",
                    GUILD_ID: "guildId",
                    AVERAGES_SOLVE_COUNT: "averages_solve_count"
                }
            },
            JUDGES: {
                ID: "id",
                JUDGE: "judge",
                NAME: "name",
                SHIRT: "shirt",
                HAIR: "hair",
                LOCATION: "location",
                OTHER: "other"
            },
            PEOPLE: {
                ID: "id",
                COMPETITION: "competition",
                TYPE: "type",
                ADDRESS: "address",
                DISPLAY_NAME: "display_name",
                LAST_BOT_MESSAGE: "last_bot_message",
                CREATED_AT: "created_at",
                STATUS: "status",
                CUP: "cup",
                TYPES: {
                    UNDEFINED: "undefined",
                    ADMIN: "admin",
                    COMPETE: "compete",
                    SCRAMBLE: "scramble",
                    RUN: "run",
                    JUDGE: "judge"
                }
            },
            SCRAMBLE_SETS: {
                ID: "id",
                COMPETITION: "competition"
            },
            SCRAMBLES: {
                ID: "id",
                COMPETITION: "competition",
                SCRAMBLE_SET: "scramble_set",
                SCRAMBLE_NUMBER: "scramble_number",
                SCRAMBLE: "scramble"
            },
            SOLVES: {
                ID: "id",
                COMPETITOR: "competitor",
                CUP: "cup",
                AVERAGE: "average",
                SCRAMBLER: "scrambler",
                RUNNER_FIRST: "runner_first",
                JUDGE: "judge",
                RUNNER_SECOND: "runner_second",
                TIME: "time",
                PENALTY: "penalty"
            }
        }

        this.permissionsNeeded = {
            'here': ['undefined'],
            'scramble': ['undefined'],
            'run': ['undefined'],
            'compete': ['undefined'],
            'judge': ['undefined'],
            'start': [],
            'close': ["undefined", "admin", "scramble", "run", "judge"],
            'help': [],
            '?': [],
            'suspend': [],
            'stop': ['admin'],
            'new competition': ['admin'],
            'new scramble set': ['admin'],
            'cancel admin': ['admin'],
            'cancel scramble': ['scramble'],
            'done scramble': ['scramble'],
            'cancel run': ['run'],
            'done run': ['run'],
            'cancel judge': ['judge'],
            'done judge': ['judge'],
            'confirm yes': ['compete'],
            'finish': ['compete']
        };

        this.judgeAttrs = [
            'name',
            'shirt',
            'hair',
            'location',
            'other'
        ]

        this.administratorActions = ['Close', 'Stop', 'New Competition', 'New Scramble Set'];

        this.inputFunctions = {
            "any": {
                "start": this.initializeUser.bind(this),
                "here": (address) => this.send(address, 'Please choose which you would like to do.', ['Scramble', 'Judge', 'Run', 'Compete']),
                "close": this.closeUser.bind(this),
                "help": (address) => this.send(address, '{{@Moderator}}'),
                "suspend": this.suspendAddress.bind(this),
                "admin": this.initializeAdmin.bind(this),
                "scramble": this.updateScrambler.bind(this),
                "judge": this.updateJudge.bind(this),
                "run": this.updateRun.bind(this),
                "compete": this.registerCompetitor.bind(this),
                "new competition": this.newCompetition.bind(this),
                "new scramble set": this.newScrambleSet.bind(this),
                "stop": this.endCompetition.bind(this),
                "info": this.info.bind(this),
            },
            "admin": {
                "cancel admin": this.updateAdmin.bind(this),
            },
            "scramble": {
                "cancel scramble": this.updateScrambler.bind(this),
                "done scramble": this.doneScramble.bind(this),
            },
            "run": {
                "cancel run": this.updateRun.bind(this),
                "done run": this.doneRun.bind(this),
            },
            "judge": {
                "cancel judge": this.updateJudge.bind(this),
                "DEFAULT": async (address, input) => {
                    if (this.judgeAttrs.includes(input.toLowerCase().split(' ')[0])) {
                        // todo what
                        await this.getPerson({ addr: address }, judge => {
                            this.query(`UPDATE judges SET ${input.toLowerCase().split(' ')[0]} = '${input.substring(input.indexOf(' ') + 1).replace("'", "\\'")}' WHERE judge = ${judge['id']}`, () => {
                                this.send(address, 'Set ' + input.toLowerCase().split(' ')[0] + ' = "' + input.substring(input.indexOf(' ') + 1) + '"');
                            });
                        });
                    }
                },
            },
            "compete": {
                "confirm yes": this.competitorConfirmTime.bind(this),
                "finish": this.competitorFinish.bind(this),
            },
            "NUMERIC": {
                "compete": {
                    "awaiting_cup": this.selectCompeteCup.bind(this),
                },
                "scramble": {
                    "waiting": this.selectScrambleCup.bind(this),
                },
                "run": {
                    "waiting": this.selectRunCup.bind(this),
                },
                "judge": {
                    "waiting": this.selectJudgeCup.bind(this),
                    "judging": this.enterTime.bind(this),
                }
            }
        }
    }

    async userInput(address_in, input, force = false) {
        console.log('CompFunctions: ' + address_in + ': ' + input);
        const address = address_in.split('_')[0] + "_" + address_in.split('_')[1];
        input = input.toLowerCase()
        await this.addressHasPermissionTo(address, input.toLowerCase(), force, async (addressHasPermission) => {
            console.log('Permission granted: ' + (force ? 'forced' : addressHasPermission));

            if (force || addressHasPermission) {
                await this.getPerson({ addr: address }, async person => {

                    let callback = () => {};

                    if (this.inputFunctions.any[input]) {
                        // check actions anyone can do
                        callback = this.inputFunctions.any[input];
                    } else if (this.inputFunctions[person[this.DB.PEOPLE.TYPE]] && this.inputFunctions[person[this.DB.PEOPLE.TYPE]][input]) {
                        // check actions this type can do
                        callback = this.inputFunctions[person[this.DB.PEOPLE.TYPE]][input];
                    } else {
                        if (!isNaN(parseFloat(input)) && this.inputFunctions.NUMERIC[person[this.DB.PEOPLE.TYPE]] && this.inputFunctions.NUMERIC[person[this.DB.PEOPLE.TYPE]][person[this.DB.PEOPLE.STATUS]]) {
                            // try numeric input detection
                            input = parseFloat(input);
                            callback = this.inputFunctions.NUMERIC[person[this.DB.PEOPLE.TYPE]][person[this.DB.PEOPLE.STATUS]];
                        } else {
                            if (this.inputFunctions[person[this.DB.PEOPLE.TYPE]] && this.inputFunctions[person[this.DB.PEOPLE.TYPE]]['DEFAULT']) {
                                // check for default action
                                callback = this.inputFunctions[person[this.DB.PEOPLE.TYPE]]['DEFAULT'];
                            } else {
                                if (person[this.DB.PEOPLE.TYPE].substring(0, 10) !== "suspended_") await this.send(address, "You can't do that!");
                            }
                        }
                    }

                    callback(address, input, person, address_in);
                });
            }
        });
    }

    registerClient(name, reference) {
        this.clients[name] = reference;
    }

    async addressHasPermissionTo(address, input, force, callback) {
        if ((this.permissionsNeeded[input] && this.permissionsNeeded[input].length === 0) || force) callback(true);
        else await this.getPerson({ addr: address }, person => {
            if (this.permissionsNeeded[input]) {
                if (this.permissionsNeeded[input].length === 0) {
                    callback(true);
                } else {
                    let answer = false;
                    if (this.permissionsNeeded[input].includes(person['type'])) answer = true;
                    callback(answer);
                }
            } else {
                if (person['type'] === 'judge' && this.judgeAttrs.includes(input.toLowerCase().split(' ')[0])) callback(true);
                else {
                    try {
                        parseFloat(input);
                        callback(true);
                    } catch (e) {
                        callback(false);
                    }
                }
            }
        });
    }

    async initializeUser(address, input, person, address_in) {
        // user just got into a channel, they need to be asked what they want to do (scramble, run, judge, compete) after getting registered in database
        await this.query("SELECT * FROM globals WHERE name = 'competition'", async result => {
            const competitionDbId = result[0]['value'];
            const type = "undefined";
            const created_at = Date.now();
            const status = "no_type";
            const cup = "undefined";
            let personal_addr = "undefined";
            if (address_in.split('_').length >= 3) personal_addr = address_in.split('_')[2];
            await this.query(`INSERT INTO people (competition, type, address, display_name, created_at, status, cup) VALUES (${competitionDbId}, "${type}", "${address}", '${personal_addr}', '${created_at}', "${status}", "${cup}");`, () => {
                if (competitionDbId === -1) this.send(address, 'No active competition! If you believe this is an error, please tell an administrator.', ['Close']);
                else this.send(address, 'Once you\'re here, please click the button or say "here". Remember, you can always just type the options on the buttons into the chat if you prefer.', ['Here']);
            });
        })
    }

    async closeUser(address) {
        await this.clients[address.split('_')[0]].endCompetition([address]);
        await this.getPerson({ addr: address }, person => {
            if (person['type'] === 'compete') this.getAverage({ competitor: person['id'] }, average => {
                this.updateCup({ avg: average['id'] }, { status: 'empty', average: 0, solve: 0 }, () => {
                    this.query(`UPDATE averages SET cup = 0 WHERE id = ${average['id']}`, () => {
                        this.updateJob('scramble');
                        this.updateJob('run');
                        this.updateJob('judge');
                    });
                });
            });
        });
        await this.updatePerson({ addr: address }, { status: 'closed' });
    }

    async suspendAddress(address, input, person) {
        if (person[this.DB.PEOPLE.TYPE].substring(0, 10) === "suspended_") await this.updatePerson({ addr: address }, { type: person[this.DB.PEOPLE.TYPE].substring(10) });
        else await this.updatePerson({ addr: address }, { type: "suspended_"+person[this.DB.PEOPLE.TYPE] });
    }

    async initializeAdmin(address) {
        const competitionDbId = -1;
        const type = "admin";
        const created_at = Date.now();
        const status = "admin";
        const cup = "undefined";
        await this.query(`INSERT INTO people (competition, type, address, created_at, status, cup) VALUES (${competitionDbId}, "${type}", "${address}", '${created_at}', "${status}", "${cup}");`, () => {
            this.send(address, 'Administrator Actions', this.administratorActions);
        });
    }

    async updateAdmin(address) {
        await this.send(address, 'Administrator Actions', this.administratorActions);
    }

    async newCompetition(address) {
        const created_at = Date.now();
        await this.query(`INSERT INTO competitions (created_at) VALUES ('${created_at}')`, () => {
            this.query(`SELECT * FROM competitions WHERE created_at = '${created_at}'`, result => {
                if (result.length === 0) {
                    console.log('Competition create did not work.');
                } else {
                    const competitionDbId = result[0]['id'];
                    this.query(`UPDATE globals SET value = ${competitionDbId} WHERE name = 'competition'`, () => {
                        this.send(address, 'Administrator Actions', this.administratorActions);
                    });
                }
            });
        });
    }

    async newScrambleSet(address) {
        await this.getGlobal('comp', comp => {
            this.query(`INSERT INTO scramble_sets (competition) VALUES (${comp})`, () => {
                this.getScrambleSet({}, scrambleSet => {
                    this.getGlobal('averages_solve_count', async max_solves => {
                        for (let i = 0; i < max_solves; i++) {
                            const scramble = generateScramble.default();
                            await this.query(`INSERT INTO scrambles (competition, scramble_set, scramble_number, scramble) VALUES (${comp}, ${scrambleSet['id']}, ${i}, "${scramble}")`);
                        }
                        await this.send(address, 'Administrator Actions', this.administratorActions);
                    });
                });
            });
        });
    }

    async info(address) {
        let s = "";
        await this.send(address, 'Loading...');
        await this.getPerson({ addr: address }, person => {
            s += "Person: " + JSON.stringify(person);
            this.getJudgeAttrs({ id: person['id'] }, judgeAttrs => {
                if (judgeAttrs) s += "\nJudge attrs: " + JSON.stringify(judgeAttrs);
            });
            this.getCups({ id: person['cup'] }, cup => {
                if (cup) s += "\nCup: " + JSON.stringify(cup);
                this.getAverage({ id: cup['average'] }, average => {
                    if (average) s += "\nAverage: " + JSON.stringify(average);
                    this.getScrambleSet({ id: average['scramble_set'] }, scrambleSet => {
                        if (scrambleSet)  s += "\nScramble set: " + JSON.stringify(scrambleSet);
                    });
                });
            });
        });
        setTimeout(() => {this.send(address, s)}, 1000);
    }

    async updateScrambler(address) {
        await this.updatePerson({ addr: address }, { type: 'scramble', status: 'waiting' }, () => {
            this.updateJob('scramble', address);
        });
    }

    async doneScramble(address) {
        // scrambler has finished scrambling, mark them as the one that did it, push the cup and solve to the next step, mark the scrambler as waiting/show them new possible cubes,
        await this.getPerson({ addr: address }, person => {
            this.getCups({ id: person['cup'] }, cup => {
                this.updateSolve({ cup: cup['id'], avg: cup['average'] }, { scrambler: person['id'] }, () => {
                    this.getAverage({ id: cup['average'] }, average => {
                        this.updateCup({ id: cup['id'] }, { status: 'awaiting_runner' }, () => {
                            this.updatePerson({ id: average['competitor'] }, { status: 'awaiting_runner' }, () => {
                                this.updatePerson({ addr: address }, { status: 'waiting', cup: 0 }, () => {
                                    this.getPerson({ id: average['competitor'] }, competitor => {
                                        this.send(competitor['address'], 'Your cube has been scrambled! Please wait for further instructions.');
                                        this.updateJob('scramble', address);
                                        this.updateJob('run');
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    async updateRun(address) {
        await this.updatePerson({ addr: address }, { type: 'run', status: 'waiting' }, () => {
            this.updateJob('run', address);
        });
    }

    async doneRun(address) {
        // runner has finished running, mark them as the one that did it, push the cup and solve to the next step, mark the runner as waiting/show them new possible cubes,
        await this.getPerson({ addr: address }, person => {
            this.getCups({ id: person['cup'] }, cup => {
                this.getAverage({ id: cup['average'] }, average => {
                    this.getSolve({ cup: cup['id'], avg: average['id'] }, solve => {
                        let newStatus = 'awaiting_judge';
                        let solveChanges = { runner_first: person['id'] };
                        if (solve['judge'] !== 0) { newStatus = 'awaiting_scrambler'; solveChanges = { runner_second: person['id'] } }
                        this.updateSolve({ cup: cup['id'], avg: cup['average'] }, solveChanges, () => {
                            this.updateCup({ id: cup['id'] }, { status: newStatus }, () => {
                                this.updatePerson({ addr: address }, { status: 'waiting', cup: 0 }, () => {
                                    this.getPerson({ id: average['competitor'] }, competitor => {
                                        // increment solve if awaiting_scrambler
                                        if (newStatus === 'awaiting_scrambler') {
                                            if (average['scramble_number'] + 1 < average['max_solves']) {
                                                this.updatePerson({ id: average['competitor'] }, { status: newStatus }, () => {
                                                    this.query(`UPDATE averages SET scramble_number = scramble_number + 1 WHERE id = ${average['id']}`, () => {
                                                        this.updateSolve({ cup: cup['id'], avg: cup['average'] }, { cup: 0 }, () => {
                                                            this.getGlobal('comp', competition => {
                                                                this.query(`INSERT INTO solves (competitor, competition, cup, average) VALUES (${competitor['id']}, ${competition}, ${cup['id']}, ${average['id']})`, () => {
                                                                    this.send(competitor['address'], 'Your cube has been delivered! Please wait for further instructions.');
                                                                    this.updateJob('run', address);
                                                                    this.updateJob('judge');
                                                                    this.updateJob('scramble');
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            } else {
                                                this.updateCup({ id: cup['id'] }, { status: 'empty', average: 0, solve: 0 }, () => {
                                                    this.query(`UPDATE averages SET cup = 0 WHERE id = ${average['id']}`, () => {
                                                        this.updateJob('run', address);
                                                        this.updateJob('judge');
                                                        this.updateJob('scramble');
                                                    });
                                                });
                                            }
                                        } else {
                                            this.send(competitor['address'], 'Your cube has been delivered! Please wait for further instructions.');
                                            this.updateJob('run', address);
                                            this.updateJob('judge');
                                            this.updateJob('scramble');
                                        }
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    async updateJudge(address, input) {
        await this.updatePerson({ addr: address }, { type: 'judge', status: 'waiting' }, () => {
            this.getPerson({ addr: address }, judge => {
                if (input.toLowerCase() === 'judge') this.query(`INSERT INTO judges (judge) VALUES (${judge['id']})`)
                this.updateJob('judge', address);
            });
        });
    }

    async registerCompetitor(address) {
        // ----------------------------------------------------- competitors ---------------------------------------
        await this.updatePerson({ addr: address }, { type: 'compete', status: 'awaiting_cup' }, () => {
            this.getGlobal('averages_solve_count', max_solves => {
                this.getPerson({ addr: address }, competitor => {
                    this.getScrambleSet({}, scrambleSet => {
                        if (!scrambleSet) {
                            console.log('No scramble set!');
                            this.send(address, 'Oops! Please tell an administrator that there are no scrambles available.');
                        } else {
                            this.getGlobal('comp', comp => {
                                this.query(`INSERT INTO averages (competition, competitor, scramble_set, cup, scramble_number, max_solves) VALUES (${comp}, ${competitor['id']}, ${scrambleSet['id']}, 'TBD', 0, ${max_solves})`, () => {
                                    this.send(address, 'Great! Please enter the number on the cup that you put your cube in.');
                                });
                            });
                        }
                    });
                });
            });
        });
    }

    async competitorConfirmTime(address) {
        await this.getPerson({ addr: address }, competitor => {
            this.getAverage({ competitor: competitor['id'] }, average => {
                this.updateCup({ avg: average['id'] }, { status: 'awaiting_runner' }, () => {
                    this.getCups({ avg: average['id'] }, cup => {
                        this.getPerson({ cup: cup['id'], type: 'judge' }, judge => {
                            this.updatePerson({ cup: cup['id'], type: 'judge' }, { status: 'waiting', cup: 0 }, () => {
                                if (average['scramble_number'] + 1 < average['max_solves']) this.send(address, 'Ok! You can go back to the competitor waiting area now to wait for your next solve. Thank you!');
                                else this.updatePerson({ id: competitor['id'] }, { status: 'finishing' }, () => {
                                    this.send(competitor['address'], 'You have finished your ' + average['max_solves'] + ' solves! Please take your cube with you, and press the Finish button to close this channel. Thank you!', ['Finish']);
                                });
                                this.updateJob('judge', judge['address']);
                                this.updateJob('run');
                            });
                        });
                    });
                });
            });
        });
    }

    async competitorFinish(address) {
        await this.getPerson({ addr: address }, person => {
            if (person['status'] === 'finishing') {
                this.updatePerson({ id: person['id'] }, { status: 'closed', cup: 0 }, () => {
                    this.clients[address.split('_')[0]].endCompetition([address]);
                });
            }
        });
    }

    async selectCompeteCup(address, numInput, person) {
        // number is the cup that the competitor put their cube in
        await this.getCups({ num: numInput }, cup => {
            if (!cup) this.send(address, "I don't recognize that cup! If you think this is an error, please tell an administrator.");
            else if (cup['status'] !== 'empty') this.send(address, 'That cup is already taken! If you think this is an error, please tell an administrator.');
            else this.query(`UPDATE averages SET cup = '${cup['id']}' WHERE competitor = ${person['id']} AND cup = 'TBD'`, () => {
                    this.updatePerson({ addr: address }, { cup: cup['id'], status: 'awaiting_scrambler' }, () => {
                        this.getAverage({ competitor: person['id'], cup: cup['id'] }, average => {
                            this.getGlobal('comp', competition => {
                                this.query(`INSERT INTO solves (competitor, competition, cup, average) VALUES (${person['id']}, ${competition}, ${cup['id']}, ${average['id']})`, () => {
                                    this.getSolve({ cup: cup['id'], avg: average['id'] }, solve => {
                                        this.updateCup({ num: numInput }, { status: 'awaiting_scrambler', average: average['id'], solve: solve['id'] }, () => {
                                            this.send(address, "Your cube is waiting to be scrambled.");
                                            this.updateJob('scramble');
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
        });
    }

    async selectScrambleCup(address, numInput) {
        // number is the cup that the scrambler wants to scramble next
        await this.getCups({ num: numInput }, cup => {
            if (!cup) this.send(address, "I don't recognize that cup!");
            else if (cup['status'] !== 'awaiting_scrambler') {
                this.send(address, "That cup doesn't need to be scrambled!");
                this.updateJob('scramble', address);
            }
            else {
                this.updatePerson({ addr: address }, { cup: cup['id'], status: 'scrambling' }, () => {
                    this.getAverage({ cup: cup['id'] }, average => {
                        this.getScramble({ set: average['scramble_set'], num: average['scramble_number'] }, scramble => {
                            this.send(address, "Scramble for cup " + cup['number'] + ": " + scramble['scramble'], ['Done Scramble', 'Cancel Scramble'], messageId => {
                                this.query(`UPDATE people SET last_bot_message = '${messageId}' WHERE address = '${address}'`);
                            }, makeScrambleImage(scramble['scramble']));
                        });
                    });
                });
            }
        });
    }

    async selectRunCup(address, numInput) {
        // number is the cup that the runner wants to run next
        await this.getCups({ num: numInput }, cup => {
            if (!cup) this.send(address, "I don't recognize that cup!");
            else if (cup['status'] !== 'awaiting_runner') {
                this.send(address, "That cup doesn't need to be run!");
                this.updateJob('run', address);
            }
            else {
                this.updatePerson({ addr: address }, { cup: cup['id'], status: 'running' }, () => {
                    this.getAverage({ cup: cup['id'] }, average => {
                        this.getSolve({ cup: cup['id'], avg: average['id'] }, solve => {
                            if (solve['judge'] === 0) {
                                this.send(address, "Running cup " + cup['number'] + ": to judging station", ['Done Run', 'Cancel Run']);
                            } else {
                                this.send(address, "Running cup " + cup['number'] + ": to scrambling station", ['Done Run', 'Cancel Run']);
                            }
                        });
                    });
                });
            }
        });
    }

    async selectJudgeCup(address, numInput) {
        // number is the cup that the judge wants to judge next
        await this.getCups({ num: numInput }, cup => {
            if (!cup) this.send(address, "I don't recognize that cup!");
            else if (cup['status'] !== 'awaiting_judge') {
                this.send(address, "That cup doesn't need to be judged!");
                this.updateJob('judge', address);
            }
            else {
                this.updatePerson({ addr: address }, { cup: cup['id'], status: 'judging' }, () => {
                    this.getAverage({ cup: cup['id'] }, average => {
                        this.getPerson({ addr: address }, judge => {
                            this.updateSolve({ cup: cup['id'], avg: average['id'] }, { judge: judge['id'] }, () => {
                                this.getPerson({ id: average['competitor'] }, competitor => {
                                    this.send(address, "Judging cup " + cup['number'] + ". Enter result in seconds to continue.", ['Cancel Judge']);
                                    this.getJudgeAttrs({ addr: address }, attrs => {
                                        this.send(competitor['address'], 'Your judge is ready! Please report to the station with your cup, number ' + cup['number']);
                                        let set_attrs = {}
                                        for (const attr in attrs) if (attr !== 'id' && attr !== 'judge' && attrs[attr] !== "") set_attrs[attr] = attrs[attr];
                                        if (Object.keys(set_attrs).length === 0) this.send(competitor['address'], 'Your judge did not set any descriptions.');
                                        else {
                                            this.send(competitor['address'], 'Your judge set the following descriptions to help you find them:');
                                            for (const attr in set_attrs) this.send(competitor['address'], attr + ': ' + set_attrs[attr]);
                                        }
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
    }

    async enterTime(address, numInput) {
        // number is the competitor's time
        await this.getPerson({ addr: address }, judge => {
            // this.updateSolve({ judge: judge['id'] }, { time: numInput }, () => {
            this.query(`UPDATE solves, cups SET time = ${numInput} ` +
                `WHERE judge = ${judge['id']} AND solves.cup = cups.id AND cups.status = 'awaiting_judge';`, () => {
                // this.getSolve({ judge: judge['id'] }, solve => {
                this.query(`SELECT solves.competitor FROM solves, cups WHERE judge = ${judge['id']} AND solves.cup = cups.id AND cups.status = 'awaiting_judge';`, solve => {
                    this.getPerson({ id: solve[0]['competitor'] }, competitor => {
                        this.send(competitor['address'], 'Please confirm this time: ' + numInput + '. If this time is wrong, please tell your judge to re input the correct time.', ['Confirm Yes'], () => {
                            // todo penalties
                            this.send(address, 'Please tell your competitor to confirm their time. If you entered the time incorrectly, just type a new time.');
                        });
                    });
                });
            });
        });
    }

    async endCompetition() {
        await this.query("SELECT * FROM people WHERE status != 'closed'", result => {
            let closedAddresses = [];
            for (const r in result) {
                closedAddresses.push(result[r]['address']);
            }
            for (const client in this.clients) this.clients[client].endCompetition(closedAddresses);
        });
        await this.query("UPDATE people SET status = 'closed'");
        await this.query("UPDATE globals SET value = -1 WHERE name = 'competition'");
        await this.query("UPDATE cups SET status = 'empty', average = 0, solve = 0");
        await this.query("UPDATE averages SET cup = 0");
    }

    async updateJob(type, newMessageAddress = undefined) {
        if (newMessageAddress) {
            await this.send(newMessageAddress, 'Loading cubes...', [], messageId => {
                this.query(`UPDATE people SET last_bot_message = '${messageId}' WHERE address = '${newMessageAddress}'`, () => {
                    this.updateJob(type);
                });
            })
        }
        if (type === 'scramble') await this.getCups({ status: 'awaiting_scrambler' }, cups => {
            let message = 'Please select which cup you are scrambling next.';
            let buttons = ['Close'];
            for (let c = 0; c < cups.length; c++) buttons.push(cups[c]['number']);
            if (buttons.length === 1) message = 'There are no cubes that need to be scrambled right now. This message will be updated when there is one.';
            this.query("SELECT * FROM people WHERE type = 'scramble' AND status = 'waiting'", result => {
                for (let s = 0; s < result.length; s++) {
                    this.clients[result[s]['address'].split('_')[0]].updateLastMessageToUser(result[s]['address'], message, buttons, result[s]['last_bot_message']);
                }
            });
        });
        else if (type === 'run') await this.getCups({ status: 'awaiting_runner' }, cups => {
            let message = 'Please select which cup you are running next.';
            let buttons = ['Close'];
            for (let c = 0; c < cups.length; c++) buttons.push(cups[c]['number']);
            if (buttons.length === 1) message = 'There are no cubes that need to be run right now. This message will be updated when there is one.';
            this.query("SELECT * FROM people WHERE type = 'run' AND status = 'waiting'", result => {
                for (let s = 0; s < result.length; s++) {
                    this.clients[result[s]['address'].split('_')[0]].updateLastMessageToUser(result[s]['address'], message, buttons, result[s]['last_bot_message']);
                }
            });
        });
        else if (type === 'judge') await this.getCups({ status: 'awaiting_judge' }, cups => {
            let message = 'Please select which cup you are judging next. Remember, you can use any of the following in the format "name This is my name" to set descriptions to help your competitors: ' + this.judgeAttrs.join(', ');
            let buttons = ['Close'];
            for (let c = 0; c < cups.length; c++) buttons.push(cups[c]['number']);
            if (buttons.length === 1) message = 'There are no cubes that need to be judged right now. This message will be updated when there is one.';
            this.query("SELECT * FROM people WHERE type = 'judge' AND status = 'waiting'", result => {
                for (let s = 0; s < result.length; s++) {
                    this.clients[result[s]['address'].split('_')[0]].updateLastMessageToUser(result[s]['address'], message, buttons, result[s]['last_bot_message']);
                }
            });
        });
    }

    async query(query, callback = () => { }, expectOne = false) {
        this.DB.connection.query(query, (err, result, _) => {
            if (err) {
                console.log(err);
            }
            if (expectOne && result.length !== 1) console.error('Expected 1 result and got ' + result.length + ' for query ' + query);
            if (result) callback(result);
            else callback([]);
        });
    }

    async send(address, content, buttons = [], callback = () => {}, files=[]) {
        await this.clients[address.split('_')[0]].sendMessageToUser(address, content, buttons, callback, files);
    }

    async getCups(args, callback = () => { }) { // id || num || status || avg
        if (args['id']) await this.query(`SELECT * FROM cups WHERE id = ${args['id']}`, result => { callback(result[0]) }, true);
        else if (args['num']) await this.query(`SELECT * FROM cups WHERE number = ${args['num']}`, result => { callback(result[0]) }, true);
        else if (args['avg']) await this.query(`SELECT * FROM cups WHERE average = ${args['avg']}`, result => { callback(result[0]) }, true);
        else if (args['status']) await this.query(`SELECT * FROM cups WHERE status = '${args['status']}'`, callback, false);
    }

    async updateCup(where, set, callback = () => { }) {
        // where: id || num || avg
        await this.getCups(where, cup => {
            let setList = [];
            for (const s in set) setList.push(s + ' = "' + set[s] + '"');
            this.query(`UPDATE cups SET ${setList.join(',')} WHERE id = ${cup['id']}`, callback);
        });
    }

    async getPerson(args, callback = () => { }) { // id || addr || (cup && type)
        if (args['id']) await this.query(`SELECT * FROM people WHERE id = ${args['id']} AND status != 'closed'`, result => { callback(result[0]) }, true);
        else if (args['cup']) await this.query(`SELECT * FROM people WHERE cup = ${args['cup']} AND status != 'closed' AND type = '${args['type']}'`, result => { callback(result[0]) }, true);
        else if (args['addr']) await this.query(`SELECT * FROM people WHERE address = '${args['addr']}' AND status != 'closed'`, result => { callback(result[0]) }, true);
    }

    async getJudgeAttrs(args, callback = () => { }) { // id || addr
        await this.getPerson(args, judge => {
            this.query(`SELECT * FROM judges WHERE judge = ${judge['id']}`, result => { callback(result[0]) }, true);
        })
    }

    async updatePerson(where, set, callback = () => { }) {
        // where: id || addr || cup
        await this.getPerson(where, person => {
            let setList = [];
            for (const s in set) setList.push(s + ' = "' + set[s] + '"');
            this.query(`UPDATE people SET ${setList.join(',')} WHERE id = ${person['id']} AND status != 'closed'`, callback);
        });
    }

    async getGlobal(name, callback = () => { }) { // comp || global variable name
        if (name === 'comp') name = 'competition';
        await this.query(`SELECT * FROM globals WHERE name = '${name}'`, result => {
            if (result[0]['value'] === 0 && result[0]['value_string'] !== '') callback(result[0]['value_string']);
            else callback(result[0]['value']);
        }, true);
    }

    // async setGlobal(name, value, valueString, callback = () => { }) { // comp || global variable name
    //     if (name === 'comp') name = 'competition';
    //     await this.query(`UPDATE globals SET value = ${value}, value_string = '${valueString}' WHERE name = ${name}`, callback);
    // }

    async getScrambleSet(args, callback = () => { }) { // none || comp || id
        if (args['id']) await this.query(`SELECT * FROM scramble_sets WHERE id = ${args['id']}`, result => { callback(result[0]) }, true);
        else if (args['comp']) await this.query(`SELECT * FROM scramble_sets WHERE competition = ${args['comp']} ORDER BY id DESC`, result => { callback(result[0]) }, false);
        else await this.getGlobal('comp', comp => { this.query(`SELECT * FROM scramble_sets WHERE competition = ${comp} ORDER BY id DESC`, result => { callback(result[0]) }, false) });
    }

    async getScramble(args, callback = () => { }) { // (comp && set && num) || (set && num)
        if (!args['comp']) await this.getGlobal('comp', comp => { this.query(`SELECT * FROM scrambles WHERE competition = ${comp} AND scramble_set = ${args['set']} AND scramble_number = ${args['num']}`, result => { callback(result[0]) }, true); })
        else await this.query(`SELECT * FROM scrambles WHERE competition = ${args['comp']} AND scramble_set = ${args['set']} AND scramble_number = ${args['num']}`, result => { callback(result[0]) }, true);
    }

    async getAverage(args, callback = () => { }) { // competitor || cup || id
        if (args['cup']) await this.query(`SELECT * FROM averages WHERE cup = '${args['cup']}'`, result => { callback(result[0]) }, true);
        else if (args['competitor']) await this.query(`SELECT * FROM averages WHERE competitor = ${args['competitor']}`, result => { callback(result[0]) }, true);
        else if (args['id']) await this.query(`SELECT * FROM averages WHERE id = ${args['id']}`, result => { callback(result[0]) }, true);
    }

    async getSolve(args, callback = () => { }) { // (cup && avg) || (judge && cup)
        // TODO when a judge finishes a solve, then enters the time for the next solve, it saves the time again as the previous solve because this doesn't check that time = 0
        if (args['judge']) await this.query(`SELECT * FROM solves WHERE judge = ${args['judge']} AND runner_second = 0`, result => { callback(result[0]) }, true);
        else await this.query(`SELECT * FROM solves WHERE cup = ${args['cup']} AND average = ${args['avg']}`, result => { callback(result[0]) }, true);
    }

    async getSolves(comp, callback = () => { }) { // comp
        await this.query(`SELECT competitor, MIN(time) FROM solves WHERE competition = ${comp} AND time != 0 GROUP BY competitor;`, result => { callback(result) }, false);
    }

    async updateSolve(where, set, callback = () => { }) {
        // where: (cup && avg) || judge
        await this.getSolve(where, solve => {
            let setList = [];
            for (const s in set) setList.push(s + ' = "' + set[s] + '"');
            this.query(`UPDATE solves SET ${setList.join(',')} WHERE id = ${solve['id']}`, callback);
        });
    }

    async getResults(callback) {
        await this.getGlobal('comp', competition => {
            if (competition === -1) callback(undefined);
            else this.query(`SELECT * FROM solves WHERE time != 0 ORDER BY time ASC`, solves => {
                let results = [];
                let alreadyPrinted = {};
                let count = 0
                for (const s in solves) {
                    this.query(`SELECT * FROM people WHERE id = ${solves[s]['competitor']}`, competitor => {
                        this.query(`SELECT * FROM averages WHERE id = ${solves[s]['average']}`, average => {
                            if (average[0]['competition'] === competition) {
                                if (!alreadyPrinted[competitor['display_name']]) {
                                    results.push({
                                        time: solves[s]['time'],
                                        address: competitor[0]['address'],
                                        personal_address: competitor[0]['display_name'],
                                    });
                                    alreadyPrinted[competitor['display_name']] = true;
                                }
                            }
                            count++;
                        }, true);
                    }, true);
                }

                const waitForResultsFinish = (callback) => {
                    if (count === solves.length) callback(results);
                    else setTimeout(() => {waitForResultsFinish(callback);}, 50);
                };

                waitForResultsFinish(callback);
            });
        });
    }

    async getScores(callback) {
        await this.query("SELECT competitor, @n := @n + 1 n, display_name, MIN(time) time " +
            "FROM solves, people, globals, (SELECT @n := 0) m " +
            "WHERE globals.name = 'competition' AND solves.competition = globals.value " +
            "  AND people.competition = globals.value AND time != 0 AND people.id = solves.competitor " +
            "GROUP BY display_name ORDER BY time;", callback);
    }
}