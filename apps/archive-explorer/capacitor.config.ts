import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = { appId: 'in.censorislabs.archive', appName: 'Archive Explorer', webDir: 'dist', plugins: { CapacitorHttp: { enabled: true } } }
export default config
