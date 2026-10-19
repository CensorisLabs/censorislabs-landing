import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = { appId: 'in.censorislabs.bankbrief', appName: 'Indian Banking Brief', webDir: 'dist', plugins: { CapacitorHttp: { enabled: true } } }
export default config
