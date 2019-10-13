import {commands, workspace} from 'coc.nvim';

import {Dispose} from '../util/dispose';
import {cmdPrefix, lineBreak} from '../util/constant';
import {execCommand, getFlutterWorkspaceFolder} from '../util/fs';
import {logger} from '../util/logger';
import {notification} from '../lib/notification';

const log = logger.getlog('global-commands')

interface ICmd {
  name?: string
  cmd: string
  desc: string
  execute: (cmd: ICmd) => Promise<void>
  getArgs?: () => Promise<string[]>
}

const getCmd = () => {
  return async ({ cmd, getArgs }: ICmd) => {
    let args: string[] = []
    if (getArgs) {
      args = await getArgs()
    }
    const { err, stdout, stderr } = await execCommand(
      `flutter ${cmd} ${args.join(' ')}`
    )
    const devLog = logger.devOutchannel
    if (stdout) {
      devLog.append(`\n${stdout}\n`)
    }
    if (stderr) {
      devLog.append(`\n${stderr}\n`)
    }
    if (err) {
      devLog.append([
        err.message,
        err.stack
      ].join('\n'))
    }
    devLog.show()
  }
}

const formatMessage = (text: string): string[] =>
  text.trim().replace(/\s+/g, ' ').split(lineBreak)

const cmds: ICmd[] = [
  {
    cmd: 'upgrade',
    desc: 'flutter upgrade',
    execute: getCmd()
  },
  {
    cmd: 'doctor',
    desc: 'flutter doctor',
    execute: getCmd()
  },
  {
    cmd: 'create',
    desc: 'flutter create',
    execute: getCmd(),
    getArgs: async (): Promise<string[]> => {
      const params = await workspace.requestInput('Input project name and other params: ')
      return params.split(' ')
    }
  },
  {
    cmd: 'pub get',
    name: 'pub.get',
    desc: 'flutter pub get',
    execute: async () => {
      const workspaceFolder = await getFlutterWorkspaceFolder()
      log(`pub get command, workspace: ${workspaceFolder}`)
      if (!workspaceFolder) {
        notification.show('Flutter project workspaceFolder not found!')
        return
      }
      const { code, err, stdout, stderr } = await execCommand('flutter pub get', { cwd: workspaceFolder })
      notification.show(formatMessage(stdout))
      if (err || code) {
        notification.show(formatMessage(stderr))
      }
    }
  }
]

export class Global extends Dispose {
  constructor() {
    super()
    cmds.forEach(cmd => {
      const { desc, execute, name } = cmd
      const cmdId = `${cmdPrefix}.${name || cmd.cmd}`
      this.push(
        commands.registerCommand(cmdId, async () => {
          const statusBar = workspace.createStatusBarItem(0, { progress: true })
          this.push(statusBar)
          statusBar.text = desc
          statusBar.show()
          await execute(cmd)
          this.remove(statusBar)
        })
      )
      commands.titles.set(cmdId, desc)
    })
  }
}
