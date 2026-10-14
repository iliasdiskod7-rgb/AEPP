import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {apiClient} from '../api/client'
import {useAuth} from '../auth/AuthContext'
import {dayAt} from './engine'
import type {DailyState,LeaderRow,LeaderboardPage,Period,Scope} from './types'
interface Gamification {data:DailyState|null;error:string;busy:boolean;refresh:()=>Promise<void>;action:(name:string,body?:unknown)=>Promise<DailyState|null>;ranking:(period:Period,scope:Scope,page?:number)=>Promise<LeaderboardPage>;demo:boolean;now:()=>number}
const Context=createContext<Gamification|null>(null)
export function GamificationProvider({children}:{children:ReactNode}) {
 const {user,refresh:refreshAccount}=useAuth(),id=user?.id??null,identity=useRef(id);identity.current=id
 const [data,setData]=useState<DailyState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const inFlight=useRef(false),abort=useRef<AbortController|null>(null),offset=useRef(0)
 const now=useCallback(()=>Date.now()+offset.current,[])
 const action=useCallback(async(name:string,body?:unknown)=>{if(!id||inFlight.current)return null;inFlight.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;try{const config={signal:controller.signal};const response=name==='get'?await apiClient.get('/gamification',config):name==='profile'?await apiClient.put('/gamification/profile',body,config):await apiClient.post(name==='complete'?'/daily-challenge/submit':'/gamification/'+name,body??{},config);if(identity.current!==id)return null;const result=response.data as DailyState;offset.current=Date.parse(result.serverNow)-Date.now();setData(result);if(name==='complete')void refreshAccount();return result}catch(cause){if(identity.current!==id||controller.signal.aborted)return null;const e=cause as {response?:{data?:{message?:string}}};setError(e.response?.data?.message??'Η αποθήκευση δεν ολοκληρώθηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.');return null}finally{if(identity.current===id){inFlight.current=false;setBusy(false)}}},[id,refreshAccount])
 const refresh=useCallback(async()=>{await action('get')},[action])
 useEffect(()=>{abort.current?.abort();inFlight.current=false;setData(null);setError('');setBusy(false);if(id)void refresh();return()=>abort.current?.abort()},[id,refresh])
 useEffect(()=>{if(!id)return;const timer=setInterval(()=>{if(document.visibilityState==='visible'&&data?.day!==dayAt(new Date(now())))void refresh()},1000);const visible=()=>{if(document.visibilityState==='visible')void refresh()};document.addEventListener('visibilitychange',visible);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[id,data?.day,refresh,now])
 const ranking=useCallback(async(period:Period,scope:Scope,page=1):Promise<LeaderboardPage>=>{const empty={items:[],page,pageSize:20,hasNextPage:false};if(!id)return empty;const result=await apiClient.get('/leaderboard',{params:{period,scope,page,pageSize:20}});if(identity.current!==id)return empty;const rows=result.data.items.map((row:{rank:number;username:string;avatar:string;currentStreak:number;totalXP:number;rankingXP:number;self:boolean}):LeaderRow=>({rank:row.rank,username:row.username,avatar:row.avatar,streak:row.currentStreak,totalXp:row.totalXP,rankingXp:row.rankingXP,self:row.self}));return {...result.data,items:rows}},[id])
 return <Context.Provider value={{data:data?.profile.id===id?data:null,error,busy,refresh,action,ranking,demo:false,now}}>{children}</Context.Provider>
}
export function useGamification(){const value=useContext(Context);if(!value)throw Error('GamificationProvider missing');return value}
