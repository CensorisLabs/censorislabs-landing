import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = { appId: 'in.censorislabs.social', appName: 'Open Social', webDir: 'dist', plugins: { CapacitorHttp: { enabled: true } } }
export default config
