import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}})
const {AuthContext,authError}=await server.ssrLoadModule('/src/auth/AuthContext.tsx')
const {ProtectedRoute}=await server.ssrLoadModule('/src/auth/AuthForms.tsx')
const {default:UserMenu}=await server.ssrLoadModule('/src/auth/UserMenu.tsx')
after(()=>server.close())
const user={id:'student',email:'student@example.com',fullName:'Μαθήτρια Δοκιμής',role:'STUDENT',createdAt:'2026-01-01'}
const value={user,token:null,progress:null,isAuthenticated:true,isLoading:false,error:'',login:async()=>{},register:async()=>{},logout:async()=>{},refresh:async()=>{}}
const render=(props,child)=>renderToStaticMarkup(createElement(AuthContext.Provider,{value:{...value,...props}},child))
test('protected workspace hides private content from guests',()=>{const html=render({user:null,isAuthenticated:false},createElement(ProtectedRoute,null,'PRIVATE_MARKER'));assert.ok(!html.includes('PRIVATE_MARKER'));assert.ok(html.includes('Σύνδεση'));assert.ok(html.includes('type="password"'));assert.ok(html.includes('autoComplete="current-password"')||html.includes('autocomplete="current-password"'))})
test('loading and role checks precede private rendering',()=>{assert.ok(!render({isLoading:true},createElement(ProtectedRoute,null,'PRIVATE_MARKER')).includes('PRIVATE_MARKER'));assert.ok(!render({},createElement(ProtectedRoute,{roles:['TEACHER']},'PRIVATE_MARKER')).includes('PRIVATE_MARKER'));assert.ok(render({user:{...user,role:'TEACHER'}},createElement(ProtectedRoute,{roles:['TEACHER']},'PRIVATE_MARKER')).includes('PRIVATE_MARKER'))})
test('header displays real identity and logout',()=>{const html=render({},createElement(UserMenu));assert.ok(html.includes(user.fullName));assert.ok(html.includes('Αποσύνδεση'));assert.ok(!html.includes('Γρηγόρης Δίσκος'))})
test('API errors preserve clear Greek messages',()=>{assert.equal(authError({response:{data:{message:'Το email χρησιμοποιείται ήδη.'}}}),'Το email χρησιμοποιείται ήδη.');assert.ok(authError({response:{status:401}}).includes('σύνδεση'));assert.ok(authError(Error('Network Error')).includes('διακομιστή'))})
