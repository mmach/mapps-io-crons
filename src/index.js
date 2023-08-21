// Module dependencies.
import { QueryList } from 'justshare-shared'
import dotenv from 'dotenv'
import { http_request, http_request_post } from './http_request.js'
import {CronJob} from 'cron';
import express from 'express';
import cors from 'cors';

const app = express();

app.set('port', process.env.PORT || (process.argv[2] && process.argv[2].split('=')[1]) || 3000)//3005);
app.use(cors())
const server = app.listen(app.get('port'), () => {
    console.log('Express server listening on port ' + app.get('port'));
});

dotenv.config()
let projects = {}


let init = () => {
    let proj = '';
    let user = ''
    http_request(QueryList.Project.LOGIN, {
        id: process.env.MAPPS_ID,
        secretKey: process.env.MAPPS_SECRET,
    }, 'pl-PL').then(succ => {
        proj = succ.data.token
        return http_request(QueryList.User.LOG_IN_INTERNAL, {
            email: process.env.USER,
            password: process.env.PASSWORD,
        }, 'pl-PL', null, succ.data.token)
    }).then(succ2 => {
        user = succ2.data.token
        return http_request('getProcessCronsQuery', {
        }, 'pl-PL', user, proj)
    }).then(succ => {
        Object.keys(projects).map(project => {
            if (!succ.data.map(i => i.project_id).includes(project)) {
                Object.keys(projects[project]).forEach(cron => {
                    projects[project][cron].stop()
                })
                projects[project] = {};
            } else {

                Object.keys(projects[project]).forEach(cron => {
                    if (!succ.data.filter(i => i.project_id == project).map(i => i.reminder_cron).includes(cron)) {
                        projects[project][cron].stop();
                        projects[project] = undefined
                    }
                })
            }
        })
        succ.data.forEach(i => {

            if (!projects[i.project_id]) {
                projects[i.project_id] = {}
            }
            if (!projects[i.project_id][i.reminder_cron]) {
                projects[i.project_id][i.reminder_cron] = new CronJob(
                    i.reminder_cron,
                    function () {
                        http_request_post('runCronQueueCommand', {
                            project_id: i.project_id,
                            reminder_cron: i.reminder_cron
                        }, 'pl-PL', null, null).then(succ => {
                            console.log('['+new Date().toLocaleString() +'] '+i.project_id+' '+i.reminder_cron,)
                        })
                    },
                    null,
                    false,
                    'America/Los_Angeles'
                );
                projects[i.project_id][i.reminder_cron].start()

            }
        })
    })
}
new CronJob(
    process.env.CRON?process.env.CRON:'0 59 * * * *',
    function () {
        init()
    },
    null,
    true,
    'America/Los_Angeles'
);

init()
