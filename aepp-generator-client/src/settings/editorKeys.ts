export function pairedEdit(value:string,start:number,end:number,key:string): {text:string;start:number;end:number;caret:number}|null {
 const pairs:Record<string,string>={'(':')','[':']',"'":"'"}
 const prefix=value.slice(value.lastIndexOf('\n',start-1)+1,start)
 let quoted=false,comment=false
 for(let i=0;i<prefix.length;i++){if(prefix[i]==="'"){if(quoted&&prefix[i+1]==="'"){i++;continue}quoted=!quoted}else if(prefix[i]==='!'&&!quoted){comment=true;break}}
 if(comment)return null
 if(start===end && (key===')'||key===']'||key==="'") && value[start]===key) return {text:key,start,end:start+1,caret:start+1}
 if(key==='Backspace'&&start===end&&start>0&&pairs[value[start-1]]===value[start])return {text:'',start:start-1,end:start+1,caret:start-1}
 if(!pairs[key]||quoted)return null
 return {text:key+value.slice(start,end)+pairs[key],start,end,caret:start+1+(end-start)}
}
