import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = { appId: 'in.censorislabs.movieguide', appName: 'Where to Watch', webDir: 'dist', plugins: { CapacitorHttp: { enabled: true } } }
export default config
