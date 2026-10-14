import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {apiClient} from '../api/client'
export interface AuthUser {id:string;email:string;fullName:string;role:'STUDENT'|'TEACHER';createdAt:string}
export interface Progress {userId:string;totalXP:number;currentStreak:number;maxStreak:number;lastChallengeDate:string|null;badges:string[]}
interface Auth {user:AuthUser|null;token:string|null;progress:Progress|null;isAuthenticated:boolean;isLoading:boolean;error:string;login:(email:string,password:string)=>Promise<void>;register:(email:string,password:string,fullName:string)=>Promise<void>;logout:()=>Promise<void>;refresh:()=>Promise<void>}
export function authError(cause:unknown):string{const e=cause as {response?:{status?:number;data?:{message?:string;errors?:unknown}}};return e.response?.data?.message??(e.response?.status===400?'Έλεγξε τα στοιχεία της φόρμας.':e.response?.status===401?'Χρειάζεται νέα σύνδεση.':'Η σύνδεση με τον διακομιστή δεν είναι διαθέσιμη. Δοκίμασε ξανά.')}
const empty:Auth={user:null,token:null,progress:null,isAuthenticated:false,isLoading:false,error:'',login:async()=>{},register:async()=>{},logout:async()=>{},refresh:async()=>{}}
export const AuthContext=createContext<Auth>(empty)
export const useAuth=()=>useContext(AuthContext)
export function AuthProvider({children}:{children:ReactNode}) {
 const [user,setUser]=useState<AuthUser|null>(null),[token,setToken]=useState<string|null>(null),[progress,setProgress]=useState<Progress|null>(null),[isLoading,setLoading]=useState(true),[error,setError]=useState('')
 const generation=useRef(0)
 const clear=useCallback(()=>{generation.current++;setUser(null);setToken(null);setProgress(null);delete apiClient.defaults.headers.common.Authorization},[])
 const refresh=useCallback(async()=>{const request=generation.current;try{const {data}=await apiClient.get('/auth/me',{timeout:15000});if(request!==generation.current)return;setUser(data.user);setProgress(data.progress);setError('')}catch(e){if(request!==generation.current)return;const status=(e as {response?:{status?:number}}).response?.status;if(status===401)clear();else setError(authError(e))}finally{setLoading(false)}},[clear])
 useEffect(()=>{void refresh();const id=apiClient.interceptors.response.use(r=>r,e=>{if(e.response?.status===401&&!e.config?.url?.includes('/auth/login'))clear();return Promise.reject(e)});const visible=()=>{if(document.visibilityState==='visible')void refresh()};document.addEventListener('visibilitychange',visible);return()=>{apiClient.interceptors.response.eject(id);document.removeEventListener('visibilitychange',visible)}},[refresh,clear])
 const authenticate=useCallback(async(path:string,body:unknown)=>{setError('');const {data}=await apiClient.post('/auth/'+path,body,{timeout:20000});generation.current++;apiClient.defaults.headers.common.Authorization='Bearer '+data.token;setToken(data.token);setUser(data.user);setProgress(data.progress);setLoading(false)},[])
 const login=useCallback((email:string,password:string)=>authenticate('login',{email,password}),[authenticate])
 const register=useCallback((email:string,password:string,fullName:string)=>authenticate('register',{email,password,fullName}),[authenticate])
 const logout=useCallback(async()=>{try{await apiClient.post('/auth/logout',{}, {timeout:15000});clear()}catch(e){if((e as {response?:{status?:number}}).response?.status===401){clear();return}throw e}},[clear])
 return <AuthContext.Provider value={{user,token,progress,isAuthenticated:!!user,isLoading,error,login,register,logout,refresh}}>{children}</AuthContext.Provider>
}
