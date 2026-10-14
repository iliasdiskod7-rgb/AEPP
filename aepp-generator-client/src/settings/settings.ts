export interface Settings {
 theme: 'light' | 'dark'; editorTheme: 'dark-default' | 'monokai' | 'vscode' | 'contrast'; density: 'comfortable' | 'compact'; fontSize: number; tabSize: 2 | 4; wordWrap: boolean; lineNumbers: boolean; autoClose: boolean; autoSaveSeconds: 0 | 5 | 10 | 30; executionDelay: number; loopLimit: 10000 | 50000 | 100000; sounds: boolean; voiceRate: 0.8 | 1 | 1.25 | 1.5
}
export const SETTINGS_KEY = 'aepp.settings.v1'
export const SOURCE_KEY = 'aepp.glossa.source.v1'
export const defaultSettings: Settings = { theme:'light', editorTheme:'dark-default', density:'comfortable', fontSize:14, tabSize:2, wordWrap:false, lineNumbers:true, autoClose:true, autoSaveSeconds:10, executionDelay:1050, loopLimit:100000, sounds:false, voiceRate:1 }
export function resolveEditorTheme(settings: Pick<Settings, 'theme' | 'editorTheme'>): Settings['editorTheme'] | 'light' {
 return settings.theme === 'light' ? 'light' : settings.editorTheme
}
export function sanitizeSettings(raw: unknown): Settings {
 const result = {...defaultSettings}; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
 const data = raw as Record<string, unknown>
 const enums = {theme:['light','dark'],editorTheme:['dark-default','monokai','vscode','contrast'],density:['comfortable','compact'],tabSize:[2,4],autoSaveSeconds:[0,5,10,30],loopLimit:[10000,50000,100000],voiceRate:[0.8,1,1.25,1.5]}
 for (const [key, values] of Object.entries(enums)) if ((values as unknown[]).includes(data[key])) Object.assign(result,{[key]:data[key]})
 for (const key of ['wordWrap','lineNumbers','autoClose','sounds']) if (typeof data[key] === 'boolean') Object.assign(result,{[key]:data[key]})
 for (const [key,min,max] of [['fontSize',12,24],['executionDelay',100,2000]] as const) {const value=data[key];if(typeof value==='number' && Number.isFinite(value)) Object.assign(result,{[key]:Math.max(min,Math.min(max,Math.round(value)))})}
 return result
}
export function restoreSettings(raw: string | null): Settings {try {const value=JSON.parse(raw ?? 'null');return value?.version===1?sanitizeSettings(value.settings):{...defaultSettings}}catch{return {...defaultSettings}}}
export function sourceStorageKey(userId?:string):string{return userId?SOURCE_KEY+'.user.'+userId:SOURCE_KEY}
export function restoreSource(fallback: string,userId?:string): string {try{return typeof localStorage==='undefined'?fallback:localStorage.getItem(sourceStorageKey(userId))??fallback}catch{return fallback}}
