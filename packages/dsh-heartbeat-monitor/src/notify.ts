/**
 * Best-effort OS notification. DSH 0.2.1-rc.5 exposes no plugin-facing
 * notification service (Electron `Notification` is only used inside the
 * desktop main process for update prompts), so this spawns the platform's own
 * notifier without a shell. Text travels through environment variables, never
 * through a command line, so it cannot inject commands.
 */
import { spawn } from 'node:child_process'

export interface NotifyCommand {
  command: string
  args: string[]
}

/** Pure: which program to run on a platform; undefined when unsupported. */
export function notifyCommand(platform: NodeJS.Platform): NotifyCommand | undefined {
  if (platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      'Add-Type -AssemblyName System.Drawing',
      '$n = New-Object System.Windows.Forms.NotifyIcon',
      '$n.Icon = [System.Drawing.SystemIcons]::Information',
      '$n.Visible = $true',
      '$n.ShowBalloonTip(10000, $env:DSH_HEARTBEAT_TITLE, $env:DSH_HEARTBEAT_BODY, [System.Windows.Forms.ToolTipIcon]::Info)',
      'Start-Sleep -Seconds 8',
      '$n.Dispose()',
    ].join('; ')
    return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script] }
  }
  if (platform === 'darwin') {
    return { command: 'osascript', args: ['-e', 'display notification (system attribute "DSH_HEARTBEAT_BODY") with title (system attribute "DSH_HEARTBEAT_TITLE")'] }
  }
  if (platform === 'linux') {
    // notify-send takes argv directly; sh reads them from env to keep one code path.
    return { command: 'sh', args: ['-c', 'exec notify-send -- "$DSH_HEARTBEAT_TITLE" "$DSH_HEARTBEAT_BODY"'] }
  }
  return undefined
}

/** Fire and forget; every failure is swallowed and reported through `onError`. */
export function systemNotify(title: string, body: string, onError: (message: string) => void, platform: NodeJS.Platform = process.platform): void {
  const cmd = notifyCommand(platform)
  if (!cmd) return onError(`当前平台 ${platform} 不支持系统通知`)
  try {
    const child = spawn(cmd.command, cmd.args, {
      env: { ...process.env, DSH_HEARTBEAT_TITLE: title.slice(0, 60), DSH_HEARTBEAT_BODY: body.slice(0, 240) },
      stdio: 'ignore',
      windowsHide: true,
      detached: false,
      timeout: 20_000,
    })
    child.on('error', e => onError(`系统通知失败：${e.message}`))
    child.unref()
  } catch (e) {
    onError(`系统通知失败：${e instanceof Error ? e.message : String(e)}`)
  }
}
