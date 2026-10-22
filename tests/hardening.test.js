const { destination, credentialsFrom, outboundOptions, tokenState, validIntrospection } = require('../src/security');
const Client = require('../src/client');
const id = '12345678-1234-1234-1234-123456789abc';
const response = (extra={}) => ({data:{access_token:'synthetic-access',agent_secret_token:'synthetic-pass',expires_in:7200,...extra}});
const make = (options={}) => new Client('fixture-client','synthetic-secret-123456','https://sentinel.example',id,options);

describe('SDK hardening boundaries',()=>{
 test.each(['http://example.com','https://u:SECRET@example.com','https://example.com/#SECRET','https://example.com\\@evil.test','https://example.com/\nsecret','file:///tmp/a','https:example.com'])('reject unsafe URL %s', url=>expect(()=>destination(url)).toThrow());
 test('base URL cannot contain query; ordinary destination can',()=>{expect(()=>destination('https://example.com/?q=1',true)).toThrow();expect(destination('https://example.com/?q=1').hostname).toBe('example.com')});
 test.each([{'Authorization':'Bearer leaked'},{'X-Agent-Secret-Token':'leaked'},{'HOST':'evil.test'},{'x-agent-user-id':'another'},{'Cookie':'session'}])('reject outgoing credential override',headers=>expect(()=>outboundOptions({headers})).toThrow());
 test.each([{url:'https://evil.test'},{maxRedirects:5},{httpsAgent:{}},{adapter:()=>{}},{auth:{}},{validateStatus:()=>true},{timeout:0},{timeout:Infinity}])('reject transport override',opts=>expect(()=>outboundOptions(opts)).toThrow());
 test('options stay unchanged',()=>{const opts={headers:{'X-Request-Id':'fixture'},timeout:1500};const copy=JSON.stringify(opts);const safe=outboundOptions(opts);expect(JSON.stringify(opts)).toBe(copy);expect(safe.maxRedirects).toBe(0);expect(safe.headers).not.toBe(opts.headers)});
 test.each([
  {'Authorization':'Bearer a','X-Agent-Secret-Token':'b','X-Agent-User-Id':id},
  {'Authorization':'Bearer a','authorization':'Bearer b','X-Agent-User-Id':id},
  {'X-Agent-Secret-Token':['a'],'X-Agent-User-Id':id},
  {'Authorization':'Bearer a, Bearer b','X-Agent-User-Id':id},
  {'X-Agent-Secret-Token':'a','X-Agent-User-Id':'x\nInjected: yes'},
 ])('reject ambiguous or malformed headers',headers=>expect(credentialsFrom(headers)).toBeNull());
 test('both unambiguous wire forms recognized',()=>{expect(credentialsFrom({'AUTHORIZATION':'Bearer pass','X-Agent-User-Id':id}).mode).toBe('bearer');expect(credentialsFrom({'X-Agent-Secret-Token':'pass','X-Agent-User-Id':id}).mode).toBe('custom')});
 test.each([0,-1,NaN,Infinity,'3600',true,null])('reject invalid token TTL %s',expires_in=>expect(()=>tokenState(response({expires_in}).data,Date.now())).toThrow());
 test('separate token lifetimes; unknown pass lifetime not cached',()=>{const now=Date.now();const p=tokenState(response({agent_secret_token_expires_in:60}).data,now);expect(p.agentTokenExpiration).toBeLessThan(p.tokenExpiration);expect(tokenState(response().data,now).agentTokenExpiration).toBe(0)});
 test('introspection verifies identity, expiry, scope, boolean and disabled status',()=>{const data={active:true,agent_id:id,expires_at:Date.now()/1000+30,scopes:'a2a'};expect(validIntrospection(data,id)).toBe(true);for(const change of [{agent_id:'wrong'},{active:'true'},{expires_at:0},{scopes:'other'},{is_active:false}])expect(validIntrospection({...data,...change},id)).toBeFalsy()});
 test('100 concurrent pass acquisitions cause one exchange',async()=>{const c=make();c.axiosInstance.post=jest.fn(async()=>{await new Promise(r=>setTimeout(r,10));return response()});const values=await Promise.all(Array.from({length:100},()=>c.getAgentSecretToken()));expect(c.axiosInstance.post).toHaveBeenCalledTimes(1);expect(new Set(values).size).toBe(1);await c.getAgentSecretToken();expect(c.axiosInstance.post).toHaveBeenCalledTimes(2)});
 test('known TTL caches; disabled caching obtains one coherent pair per operation',async()=>{const c=make({agentTokenTtlSeconds:60,cacheTokens:false});c.axiosInstance.post=jest.fn().mockResolvedValue(response());await c.getRequestHeaders();expect(c.axiosInstance.post).toHaveBeenCalledTimes(1);await c.getRequestHeaders();expect(c.axiosInstance.post).toHaveBeenCalledTimes(2)});
 test('failed exchange clears partial credentials and permits later recovery',async()=>{const c=make();c.axiosInstance.post=jest.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response({expires_in:'bad'})).mockResolvedValueOnce(response());await c.getAgentSecretToken();await expect(c.getAgentSecretToken()).rejects.toThrow();expect(c.accessToken).toBeNull();expect(c.agentSecretToken).toBeNull();expect(await c.getAgentSecretToken()).toBe('synthetic-pass')});
 test('zero retries is honored; writes never replay',()=>{const c=make({maxRetries:0});expect(c.config.maxRetries).toBe(0);const enabled=make();for(const method of ['POST','PUT','DELETE','PATCH'])expect(enabled._shouldRetry({response:{status:503}},{method})).toBe(false);expect(enabled._shouldRetry({response:{status:503}},{method:'GET'})).toBe(true)});
 test('cross-origin RPC cannot request access-token credentials',async()=>{const c=make();c.getAccessToken=jest.fn();await expect(c.rpcCall('work',{},'https://other.example/rpc',false)).rejects.toThrow();expect(c.getAccessToken).not.toHaveBeenCalled()});
 test('remote error bodies and transport messages are not reflected',()=>{const c=make();for(const e of [{response:{status:400,data:{error:'SECRET_CANARY'}}},{message:'SECRET_CANARY'}]){try{c._handleRequestError(e)}catch(err){expect(String(err)).not.toContain('SECRET_CANARY')}}});
 test('cancellation interrupts retry sleep',async()=>{const c=make();const ctl=new AbortController();const p=c._sleep(30000,ctl.signal);ctl.abort();await expect(p).rejects.toThrow('cancelled')});
 test('new metadata method returns verified allowlisted fields only',async()=>{const c=make();c.getAccessToken=jest.fn().mockResolvedValue('synthetic-service-token');c.axiosInstance.post=jest.fn().mockResolvedValue({data:{active:true,agent_id:id,scopes:'a2a',expires_at:Date.now()/1000+60,secret:'never return'}});const result=await c.introspectToken('pass',id);expect(result.active).toBe(true);expect(result.secret).toBeUndefined()});
});
