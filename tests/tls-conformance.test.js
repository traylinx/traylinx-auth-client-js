const {spawn} = require('node:child_process');
const {createInterface} = require('node:readline');
const fs = require('node:fs');
const https = require('node:https');
const axios = require('axios');
const Client = require('../src/client');
let server, fixture, oldCA;
const id='12345678-1234-1234-1234-123456789abc';
let client;

beforeAll(async()=>{
 server=spawn('python3',[require('node:path').join(__dirname,'fixtures/https_server.py')],{stdio:['pipe','pipe','inherit']});
 fixture=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('TLS fixture startup timeout')),10000);
  const lines=createInterface({input:server.stdout});
  lines.once('line',line=>{clearTimeout(timer);resolve(JSON.parse(line));lines.close()});
  server.once('error',reject);
 });
 oldCA=https.globalAgent.options.ca;
 https.globalAgent.options.ca=fs.readFileSync(fixture.cert);
 client=new Client('fixture-client','synthetic-secret-123',fixture.url,id,{timeout:1000,maxRetries:1,retryDelay:100});
},15000);
afterAll(async()=>{
 https.globalAgent.options.ca=oldCA;
 if(server){server.stdin.end();await new Promise(r=>server.once('close',r))}
});
const stats=()=>axios.get(fixture.url+'/stats',{proxy:false}).then(r=>r.data);

test('real HTTPS token exchange, verified metadata and wire format',async()=>{
 const headers=await client.getAgentRequestHeaders();
 expect(headers).toEqual({'X-Agent-Secret-Token':'fixture-pass','X-Agent-User-Id':id});
 expect(await client.validateToken('fixture-pass',id)).toBe(true);
 expect(await client.validateToken('wrong-pass',id)).toBe(false);
 const s=await stats();
 expect(s.counts['/oauth/token']).toBe(1);
 const call=s.observed.find(x=>x.path==='/oauth/agent/introspect');
 expect(call.headers.Authorization).toBe('Bearer fixture-access');
 expect(new URLSearchParams(call.body).get('agent_user_id')).toBe(id);
});
test('redirect never reaches destination with credentials',async()=>{
 await expect(client.rpcCall('work',{},fixture.url+'/redirect',true)).rejects.toThrow();
 expect((await stats()).counts['/leak']).toBeUndefined();
});
test('POST never replayed; remote error body not reflected',async()=>{
 await expect(client.rpcCall('work',{},fixture.url+'/write',true)).rejects.not.toThrow('SECRET_CANARY');
 expect((await stats()).counts['/write']).toBe(1);
});
test('safe GET retry works under shared deadline',async()=>{
 const r=await client.axiosInstance.get(fixture.url+'/retry');expect(r.data.ok).toBe(true);
 expect((await stats()).counts['/retry']).toBe(2);
});
test('oversized response bounded',async()=>{
 await expect(client.rpcCall('work',{},fixture.url+'/large',true)).rejects.toThrow();
});
test('slow drip cannot extend wall-clock timeout indefinitely',async()=>{
 const start=Date.now();
 await expect(client.rpcCall('work',{},fixture.url+'/slow',true)).rejects.toThrow();
 expect(Date.now()-start).toBeLessThan(3000);
});
test('caller cancellation ends real read',async()=>{
 const controller=new AbortController();const pending=client.axiosInstance.get(fixture.url+'/slow',{signal:controller.signal});
 setTimeout(()=>controller.abort(),30);
 await expect(pending).rejects.toThrow();
});
