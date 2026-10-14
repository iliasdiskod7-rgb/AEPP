import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { defaultSettings, restoreSettings, resolveEditorTheme, sanitizeSettings, SETTINGS_KEY, type Settings } from './settings'
import './settings.css'
import './editor-theme.css'
import { applyTheme } from './applyTheme'
type Sound = 'success' | 'error' | 'streak'
const fallback = { settings:defaultSettings, editorTheme:resolveEditorTheme(defaultSettings), update:(_patch:Partial<Settings>)=>{}, reset:()=>{}, persistent:true, unlockAudio:()=>{}, playSound:(_kind:Sound)=>{}, speak:(_text:string)=>false }
const SettingsContext = createContext(fallback)
export { SettingsContext }
export const useSettings = () => useContext(SettingsContext)
export function SettingsProvider({children}:{children:ReactNode}) {
 const [settings,setSettings]=useState(()=>{try{return restoreSettings(localStorage.getItem(SETTINGS_KEY))}catch{return {...defaultSettings}}})
 const [persistent,setPersistent]=useState(()=>{try{localStorage.getItem(SETTINGS_KEY);return true}catch{return false}})
 const current=useRef(settings);current.current=settings
 const audio=useRef<AudioContext|null>(null)
 const update=useCallback((patch:Partial<Settings>)=>{const next=sanitizeSettings({...current.current,...patch});current.current=next;setSettings(next);try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({version:1,settings:next}));setPersistent(true)}catch{setPersistent(false)}},[])
 const reset=useCallback(()=>update(defaultSettings),[update])
 useLayoutEffect(() => {
  applyTheme(settings)
 }, [settings.theme, settings.density, settings.fontSize])
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===SETTINGS_KEY){const next=restoreSettings(event.newValue);current.current=next;setSettings(next)}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[])
 const unlockAudio=useCallback(()=>{if(!current.current.sounds)return;try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>{})}catch{}},[])
 const playSound=useCallback((kind:Sound)=>{if(!current.current.sounds)return;try{const context=audio.current??=new AudioContext();void context.resume().catch(()=>{});const notes=kind==='error'?[220,160]:kind==='streak'?[440,554,659]:[523,659];notes.forEach((frequency,index)=>{const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+index*.12;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.035,start);gain.gain.exponentialRampToValueAtTime(.001,start+.13);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+.14)})}catch{}},[])
 const speak=useCallback((text:string)=>{if(typeof window==='undefined'||!('speechSynthesis' in window))return false;try{window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang='el-GR';speech.rate=current.current.voiceRate;window.speechSynthesis.speak(speech);return true}catch{return false}},[])
 useEffect(()=>()=>{void audio.current?.close().catch(()=>{});if('speechSynthesis' in window)window.speechSynthesis.cancel()},[])
 return <SettingsContext.Provider value={{settings,editorTheme:resolveEditorTheme(settings),update,reset,persistent,unlockAudio,playSound,speak}}>{children}</SettingsContext.Provider>
}
