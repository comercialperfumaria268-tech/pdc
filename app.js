/* ===== Supabase ===== */
let CFG0=null;try{CFG0=JSON.parse(localStorage.getItem('sb_cfg')||'null')}catch(e){}
const CFG=CFG0||window.APP_CONFIG||{};
const SCHEMA_SQL="-- Estoque & PDV: cria\u00e7\u00e3o do banco no Supabase\n-- Cole este arquivo em: Supabase > SQL Editor > New query > Run\n-- Cada tabela guarda o registro completo em JSON (coluna \"data\"); a coluna \"id\" \u00e9 a chave.\n\ncreate or replace function public.touch_updated_at() returns trigger\nlanguage plpgsql as $$ begin new.updated_at = now(); return new; end $$;\n\ndo $$\ndeclare t text;\nbegin\n  foreach t in array array['products','clients','users','sales','moves','nfes','ap','ar','conf','promos','settings'] loop\n    execute format('create table if not exists public.%I (id text primary key, data jsonb not null, updated_at timestamptz not null default now())', t);\n    execute format('drop trigger if exists touch on public.%I', t);\n    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);\n    execute format('alter table public.%I enable row level security', t);\n    execute format('drop policy if exists \"acesso autenticado\" on public.%I', t);\n    execute format('create policy \"acesso autenticado\" on public.%I for all to authenticated using (true) with check (true)', t);\n  end loop;\nend $$;\n\n-- \u00cdndices \u00fateis para consultas diretas no banco\ncreate index if not exists products_barcode_idx on public.products ((data->>'barcode'));\ncreate index if not exists products_sku_idx     on public.products ((data->>'sku'));\ncreate index if not exists sales_t_idx          on public.sales (((data->>'t')::bigint));\ncreate index if not exists ar_due_idx           on public.ar ((data->>'due'));\ncreate index if not exists ap_due_idx           on public.ap ((data->>'due'));\n";
const SB=(window.supabase&&CFG.SUPABASE_URL&&!/SEU-PROJETO/.test(CFG.SUPABASE_URL))?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const TABLES=['products','clients','users','sales','moves','nfes','ap','ar','conf','promos'];
let snap={},timer=null,syncing=false,pending=false;
const setSync=t=>{const e=document.getElementById('sync');if(e)e.textContent=t};
async function saveFile(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
async function loadRemote(){const nd={};
 for(const t of TABLES){let rows=[],from=0;for(;;){const {data,error}=await SB.from(t).select('id,data').range(from,from+999);if(error)throw error;rows=rows.concat(data);if(data.length<1000)break;from+=1000}nd[t]=rows.map(r=>r.data)}
 const {data,error}=await SB.from('settings').select('data').eq('id','cfg').maybeSingle();if(error)throw error;
 nd.cfg=data?data.data:{name:'',doc:'',addr:''};
 const byT=(a,b)=>(b.t||0)-(a.t||0),byId=(a,b)=>a.id<b.id?-1:1;
 ['sales','moves','nfes','conf'].forEach(k=>nd[k].sort(byT));['products','clients','users','ap','ar','promos'].forEach(k=>nd[k].sort(byId));
 db=nd;snap={};TABLES.forEach(t=>{snap[t]=Object.fromEntries(db[t].map(x=>[x.id,JSON.stringify(x)]))});snap.cfg=JSON.stringify(db.cfg)}
async function flush(){if(syncing){timer=setTimeout(flush,300);return}syncing=true;pending=false;
 try{for(const t of TABLES){const cur={};db[t].forEach(x=>cur[x.id]=JSON.stringify(x));
   const up=Object.keys(cur).filter(id=>snap[t][id]!==cur[id]).map(id=>({id,data:JSON.parse(cur[id])})),del=Object.keys(snap[t]).filter(id=>!(id in cur));
   for(let i=0;i<up.length;i+=500){const {error}=await SB.from(t).upsert(up.slice(i,i+500));if(error)throw error}
   for(let i=0;i<del.length;i+=100){const {error}=await SB.from(t).delete().in('id',del.slice(i,i+100));if(error)throw error}
   snap[t]=cur}
  const c=JSON.stringify(db.cfg);if(c!==snap.cfg){const {error}=await SB.from('settings').upsert({id:'cfg',data:db.cfg});if(error)throw error;snap.cfg=c}
  setSync('✓ salvo no Supabase')}catch(e){console.error(e);setSync('⚠ erro ao salvar (tentando de novo)');pending=true}
 syncing=false;if(pending)timer=setTimeout(flush,2000)}
window.addEventListener('beforeunload',e=>{if(SB&&(pending||syncing)){e.preventDefault();e.returnValue=''}});
function ensureAll(){db.clients=db.clients||[];db.users=db.users||[];db.nfes=db.nfes||[];db.ap=db.ap||[];db.ar=db.ar||[];db.cfg=db.cfg||{name:'',doc:'',addr:''};ensureCfg()}
function sbLoginView(){document.getElementById('nav').innerHTML='';document.getElementById('app').innerHTML=`<div class="card" style="max-width:380px;margin:40px auto"><h2>Entrar no sistema</h2><div class="f"><div class="w"><label>E-mail</label><input id="sb_e" type="email" autocomplete="username"></div><div class="w"><label>Senha</label><input id="sb_p" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')sbLogin()"></div></div><button class="b" style="margin-top:12px" onclick="sbLogin()">Entrar</button><p id="sb_m" class="dg"></p></div>`}
async function sbLogin(){const m=document.getElementById('sb_m');m.textContent='Entrando…';
 try{const {error}=await SB.auth.signInWithPassword({email:document.getElementById('sb_e').value.trim(),password:document.getElementById('sb_p').value});
  if(error){const t=String(error.message||error),c=String(error.code||'');
   m.textContent=/invalid login/i.test(t)?'Senha incorreta ou e-mail não confere com o usuário do Supabase. ('+t+')':/not confirmed/i.test(t)?'Usuário não confirmado. No Supabase, recrie o usuário marcando "Auto Confirm User". ('+t+')':/api key|apikey|jwt/i.test(t+c)?'A chave do config.js está errada. Copie de novo a anon public em Project Settings > API. ('+t+')':'Erro: '+t;return}
  boot()}catch(e){m.textContent='Não consegui falar com o Supabase. Confira a URL no config.js e a internet. ('+(e.message||e)+')'}}
function copySql(){navigator.clipboard.writeText(SCHEMA_SQL).then(()=>alert('SQL copiado! Cole em Supabase > SQL Editor > New query > Run.'),()=>alert('Não foi possível copiar. Abra o arquivo supabase/schema.sql.'))}
function sbSave(){const u=document.getElementById('sbu').value.trim().replace(/\/$/,''),k=document.getElementById('sbk').value.trim();if(!/^https:\/\/.+\.supabase\.co$/.test(u)||k.length<20){alert('Informe a Project URL (https://xxxx.supabase.co) e a chave anon public.');return}localStorage.setItem('sb_cfg',JSON.stringify({SUPABASE_URL:u,SUPABASE_ANON_KEY:k}));location.reload()}
function sbOff(){if(confirm('Desconectar do Supabase e voltar ao modo local?')){localStorage.removeItem('sb_cfg');location.reload()}}
async function boot(){
 if(!SB){setSync('modo local (sem Supabase)');render();return}
 try{const {data:{session}}=await SB.auth.getSession();if(!session){sbLoginView();return}
  setSync('⏳ carregando…');await loadRemote();ensureAll();
  if(!localStorage.getItem('estoque_pdv_mig')){const loc=localStorage.getItem('estoque_pdv');if(loc&&!db.users.length&&!db.products.length){if(confirm('Encontrei dados salvos neste navegador (modo local). Importar para o Supabase?')){try{db=JSON.parse(loc);ensureAll();save()}catch(e){alert('Os dados locais estão inválidos.')}}localStorage.setItem('estoque_pdv_mig','1')}}setSync('✓ Supabase conectado');render()}
 catch(e){console.error(e);document.getElementById('nav').innerHTML='';document.getElementById('app').innerHTML=`<div class="card" style="max-width:520px;margin:40px auto"><h2>Erro ao conectar</h2><p class="mu">${esc(e.message||String(e))}</p><p>Confira o <b>config.js</b> e se o arquivo <b>supabase/schema.sql</b> foi executado no projeto.</p><button class="b" onclick="boot()">Tentar de novo</button></div>`}}
/* ===== Aplicação ===== */
const $=s=>document.querySelector(s),R=n=>(+n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),N=n=>(+n||0).toLocaleString('pt-BR');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const dt=t=>new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
let db={products:[],sales:[],moves:[]},tab='dash',cart=[],q='';
if(!SB){try{const s=localStorage.getItem('estoque_pdv');if(s)db=JSON.parse(s)}catch(e){}}
db.clients=db.clients||[];db.users=db.users||[];db.nfes=db.nfes||[];db.ap=db.ap||[];db.ar=db.ar||[];db.cfg=db.cfg||{name:'',doc:'',addr:''};
let me=null,curCli='',pays=[],disc=0,dlv=newDlv(),nf=null;function newDlv(){return{on:0,name:'',phone:'',addr:'',fee:0,notes:''}}
const ROLE={admin:'Administrador',gerente:'Gerente',caixa:'Caixa'};
const ALLOW={admin:null,gerente:['dash','pdv','prod','mov','nfe','conf','promo','cli','vend','fin'],caixa:['pdv','cli','vend']};
const can=k=>{const a=ALLOW[me.role];return !a||a.includes(k)};
const rf=id=>{const e=$('#'+id);if(e){e.focus();e.setSelectionRange(1e3,1e3)}};
function nextSku(){let m=0;db.products.forEach(p=>{const r=/^PRD-(\d+)$/.exec(p.sku||'');if(r)m=Math.max(m,+r[1])});return 'PRD-'+String(m+1).padStart(5,'0')}
function save(){if(!SB){try{localStorage.setItem('estoque_pdv',JSON.stringify(db))}catch(e){}return}pending=true;clearTimeout(timer);timer=setTimeout(flush,300);setSync('⏳ salvando…')}
const P=id=>db.products.find(p=>p.id===id);
const TABS=[['dash','Painel'],['pdv','PDV'],['prod','Produtos'],['mov','Movimentações'],['nfe','Entrada NF-e'],['conf','Conferência de preços'],['promo','Promoções'],['cli','Clientes'],['vend','Vendas'],['fin','Financeiro'],['usr','Usuários'],['bkp','Backup']];
function go(t){tab=t;render()}
function render(){
 if(!db.users.length||!me){$('#nav').innerHTML='';$('#app').innerHTML=authView();return}
 const vis=TABS.filter(([k])=>can(k));if(!can(tab))tab=vis[0][0];
 $('#nav').innerHTML=vis.map(([k,n])=>`<button class="${k===tab?'on':''}" onclick="go('${k}')">${n}${k==='conf'&&db.conf.some(c=>c.status==='pendente')?' 🔒'+db.conf.filter(c=>c.status==='pendente').length:''}</button>`).join('')+`<button style="margin-left:auto" onclick="me=null;cart=[];render()">Sair · ${esc(me.name)}</button>`;
 $('#app').innerHTML=({dash,pdv,prod,mov,nfe,conf,promo,cli,vend,fin,usr,bkp})[tab]();
 if(tab==='pdv'&&document.activeElement.tagName!=='INPUT'){const e=$('#bq');e&&e.focus()}
}
function modal(h,w){$('#mb').className=w?'wide':'';$('#mb').innerHTML=h;$('#md').style.display='flex'}
function close_(){$('#md').style.display='none'}
$('#md').addEventListener('click',e=>{if(e.target.id==='md')close_()});
const low=p=>p.stock<=p.min;
function addMove(pid,type,qty,note){const p=P(pid);db.moves.unshift({id:uid(),t:Date.now(),pid,name:p.name,type,qty,after:p.stock,note:note||''})}

/* PAINEL */
function dash(){
 const d0=new Date();d0.setHours(0,0,0,0);
 const hoje=db.sales.filter(s=>!s.canceled&&s.t>=d0);
 const fat=hoje.reduce((a,s)=>a+s.total,0),luc=hoje.reduce((a,s)=>a+s.total-s.cost,0);
 const custo=db.products.reduce((a,p)=>a+p.cost*p.stock,0),venda=db.products.reduce((a,p)=>a+p.price*p.stock,0);
 const bx=db.products.filter(low).sort((a,b)=>a.stock-b.stock);
 const top={};db.sales.filter(s=>!s.canceled).forEach(s=>s.items.forEach(i=>top[i.name]=(top[i.name]||0)+i.q));
 const tp=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);
 return `<h2>Painel</h2><div class="grid">
 <div class="card kpi"><small>Vendas hoje</small><b>${hoje.length}</b></div>
 <div class="card kpi"><small>Faturamento hoje</small><b>${R(fat)}</b></div>
 <div class="card kpi"><small>Lucro hoje</small><b>${R(luc)}</b></div>
 <div class="card kpi"><small>Produtos</small><b>${db.products.length}</b></div>
 <div class="card kpi"><small>Estoque a custo</small><b>${R(custo)}</b></div>
 <div class="card kpi"><small>Estoque a preço de venda</small><b>${R(venda)}</b></div></div>
 <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
 <div class="card"><h3>⚠️ Estoque baixo (${bx.length})</h3>${bx.length?`<div class="tw"><table>${bx.map(p=>`<tr><td>${esc(p.name)}</td><td class="r ${p.stock<=0?'dg':'wn'}">${N(p.stock)} / mín ${N(p.min)}</td></tr>`).join('')}</table></div>`:'<p class="mu">Tudo em dia.</p>'}</div>
 <div class="card"><h3>🏆 Mais vendidos</h3>${tp.length?`<table>${tp.map(([n,q])=>`<tr><td>${esc(n)}</td><td class="r">${N(q)} un</td></tr>`).join('')}</table>`:'<p class="mu">Sem vendas ainda.</p>'}</div></div>
 ${db.products.length?'':'<div class="card">Comece em <b>Produtos</b> para cadastrar seus itens (ou use <b>Backup → Carregar exemplo</b>).</div>'}`;
}

/* PDV */
function pdvSale(){
 const t=q.toLowerCase();
 const list=db.products.filter(p=>!t||[p.name,p.sku,p.barcode,p.cat].some(v=>String(v||'').toLowerCase().includes(t))).slice(0,60);
 const I=(k,l,ex='')=>`<label>${l}</label><input ${ex} value="${esc(dlv[k])}" oninput="dlv.${k}=this.value">`;
 return `<div class="pdv"><div class="card">
 <input id="bq" placeholder="Buscar nome, SKU ou ler código de barras + Enter" value="${esc(q)}" oninput="q=this.value;pl()" onkeydown="if(event.key==='Enter')scan(this.value)">
 <div class="pl" id="pl">${plHtml(list)}</div></div>
 <div class="card"><h3>Carrinho</h3>${cart.length?`<div class="tw"><table>${cart.map((c,i)=>{const p=P(c.id),X=lt(c);return `<tr><td>${esc(p.name)}${X.promo?` <span class="tag wn">🏷 ${esc(X.promo.name)}</span>`:''}<br><small class="mu">${R(p.price)}</small></td><td><button class="s" onclick="qty(${i},-1)">−</button> ${c.q} <button class="s" onclick="qty(${i},1)">+</button></td><td class="r">${X.promo?`<s class="mu">${R(p.price*c.q)}</s><br>`:''}${R(X.t)}</td><td><button class="s d" onclick="cart.splice(${i},1);render()">✕</button></td></tr>`}).join('')}</table></div>`:'<p class="mu">Vazio. Toque num produto.</p>'}
 <div class="f" style="margin-top:12px"><div><label>Desconto (R$)</label><input type="number" min="0" step="0.01" value="${disc||''}" oninput="disc=+this.value||0;sumUI()"></div>
 <div><label>Cliente (opcional)</label><select onchange="setCli(this.value)"><option value="">Consumidor não identificado</option>${db.clients.map(c=>`<option value="${c.id}" ${c.id===curCli?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
 <div class="w"><label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--tx)"><input type="checkbox" style="width:auto" ${dlv.on?'checked':''} onchange="togDlv(this.checked)"> 🚚 Venda com entrega</label></div>
 ${dlv.on?`<div class="w">${I('name','Destinatário')}</div><div>${I('phone','Telefone')}</div><div><label>Taxa de entrega (R$)</label><input type="number" min="0" step="0.01" value="${dlv.fee||''}" oninput="dlv.fee=+this.value||0;sumUI()"></div><div class="w">${I('addr','Endereço completo *')}</div><div class="w">${I('notes','Observações / data prevista')}</div>`:''}</div>
 <div id="pa" style="margin-top:12px">${payHtml()}</div><div id="sm" style="margin-top:10px">${sumHtml()}</div>
 <div class="row" style="margin-top:10px"><button class="b" onclick="finish()" ${cart.length?'':'disabled'}>Finalizar venda</button><button class="s" onclick="cart=[];pays=[];disc=0;dlv=newDlv();render()">Limpar</button></div></div></div>`;
}
const plHtml=l=>l.length?l.map(p=>`<button class="pi ${p.stock<=0||p.hold?'z':''}" onclick="add('${p.id}')"><b>${esc(p.name)}</b><br>${R(p.price)}${promoOn(p)?' 🏷':''}<br><small class="${low(p)?'wn':'mu'}">Estoque: ${N(p.stock)}${p.hold?' · 🔒 conferir preço':''}</small></button>`).join(''):'<p class="mu">Nenhum produto.</p>';
function pl(){const t=q.toLowerCase();$('#pl').innerHTML=plHtml(db.products.filter(p=>!t||[p.name,p.sku,p.barcode,p.cat].some(v=>String(v||'').toLowerCase().includes(t))).slice(0,60))}
function scan(v){v=v.trim();const p=db.products.find(p=>p.barcode===v||p.sku===v);if(p){add(p.id);q='';render()}}
function add(id){const p=P(id);if(p.hold){alert('🔒 Produto travado: confirme o preço na aba Conferência de preços.');return}const c=cart.find(c=>c.id===id),n=(c?c.q:0)+1;if(n>p.stock){alert('Estoque insuficiente: '+p.name+' ('+N(p.stock)+' disponível)');return}c?c.q=n:cart.push({id,q:1});render()}
function qty(i,d){const c=cart[i],n=c.q+d;if(n<1){cart.splice(i,1)}else if(n>P(c.id).stock){alert('Estoque insuficiente')}else c.q=n;render()}

/* PRODUTOS */
let pq='';
function prod(){
 const t=pq.toLowerCase(),l=db.products.filter(p=>!t||[p.name,p.sku,p.barcode,p.cat].some(v=>String(v||'').toLowerCase().includes(t)));
 return `<h2>Produtos</h2><div class="card"><div class="row"><input placeholder="Buscar produto…" value="${esc(pq)}" id="pq" oninput="pq=this.value;render();rf('pq')"><button class="b" onclick="pform()">+ Novo produto</button></div></div>
 <div class="card tw"><table><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th class="r">Custo</th><th class="r">Preço</th><th class="r">Margem</th><th class="r">Estoque</th><th></th></tr>
 ${l.map(p=>`<tr><td>${esc(p.name)}</td><td class="mu">${esc(p.sku)}</td><td>${p.cat?`<span class="tag">${esc(p.cat)}</span>`:''}</td><td class="r">${R(p.cost)}</td><td class="r">${R(p.price)}</td><td class="r">${p.cost?N(((p.price-p.cost)/p.price*100).toFixed(0))+'%':'-'}</td><td class="r ${p.stock<=0?'dg':low(p)?'wn':''}"><b>${N(p.stock)}</b> ${esc(p.un||'')}</td><td><button class="s" onclick="pform('${p.id}')">Editar</button> <button class="s" onclick="mform('${p.id}')">Mov.</button></td></tr>`).join('')||'<tr><td colspan=8 class="mu">Nenhum produto cadastrado.</td></tr>'}</table></div>`;
}
function pform(id){const p=id?P(id):{},fis=p.fis||{};modal(`<h3>${id?'Editar':'Novo'} produto</h3><div class="f">
 <div class="w"><label>Nome *</label><input id="f_n" value="${esc(p.name)}"></div>
 <div><label>SKU</label><input id="f_s" value="${esc(id?p.sku:nextSku())}"></div><div><label>Código de barras</label><input id="f_b" value="${esc(p.barcode)}"></div>
 <div><label>Categoria</label><input id="f_c" value="${esc(p.cat)}"></div><div><label>Unidade</label><input id="f_u" value="${esc(p.un||'un')}"></div>
 <div><label>Custo (R$)</label><input id="f_k" type="number" step="0.01" value="${p.cost??''}"></div><div><label>Preço de venda (R$) *</label><input id="f_p" type="number" step="0.01" value="${p.price??''}"></div>
 ${id?'':'<div><label>Estoque inicial</label><input id="f_e" type="number" value="0"></div>'}<div><label>Estoque mínimo</label><input id="f_m" type="number" value="${p.min??5}"></div>
 <div class="w"><details ${p.fis?'open':''}><summary class="mu" style="cursor:pointer">Tributação (NCM, CFOP, ICMS, PIS, COFINS)</summary><div class="f" style="margin-top:8px">
 <div><label>NCM</label><input id="t_ncm" value="${esc(fis.ncm)}"></div><div><label>CEST</label><input id="t_cest" value="${esc(fis.cest)}"></div>
 <div><label>Origem</label><input id="t_orig" value="${esc(fis.orig)}"></div><div><label>CFOP de venda</label><input id="t_cfop" value="${esc(fis.cfop)}"></div>
 <div><label>ICMS CST/CSOSN</label><input id="t_icms" value="${esc(fis.icms)}"></div><div><label>Alíq. ICMS %</label><input id="t_icmsA" value="${esc(fis.icmsA)}"></div>
 <div><label>PIS CST</label><input id="t_pis" value="${esc(fis.pis)}"></div><div><label>COFINS CST</label><input id="t_cof" value="${esc(fis.cof)}"></div></div></details></div></div>
 <div class="row" style="margin-top:14px"><button class="b" onclick="psave('${id||''}')">Salvar</button><button class="s" onclick="close_()">Cancelar</button>${id?`<button class="s d" onclick="pdel('${id}')">Excluir</button>`:''}</div>`)}
function psave(id){
 const g=k=>$('#f_'+k).value.trim(),name=g('n'),price=+g('p');
 if(!name||!(price>=0)||g('p')===''){alert('Informe nome e preço.');return}
 const bc=g('b');if(bc&&db.products.some(p=>p.barcode===bc&&p.id!==id)){alert('Código de barras já cadastrado.');return}
 const sku=g('s')||nextSku();if(db.products.some(p=>p.sku===sku&&p.id!==id)){alert('SKU já cadastrado.');return}const d={name,sku,barcode:bc,cat:g('c'),un:g('u'),cost:+g('k')||0,price,min:+g('m')||0,fis:Object.fromEntries(['ncm','cest','orig','cfop','icms','icmsA','pis','cof'].map(k=>[k,$('#t_'+k).value.trim()]))};
 if(id)Object.assign(P(id),d);else{const p={id:uid(),stock:0,...d};db.products.push(p);const e=+g('e')||0;if(e>0){p.stock=e;addMove(p.id,'entrada',e,'Estoque inicial')}}
 save();close_();render();
}
function pdel(id){if(confirm('Excluir este produto? O histórico de vendas é mantido.')){db.products=db.products.filter(p=>p.id!==id);db.conf=db.conf.filter(c=>c.pid!==id);cart=cart.filter(c=>c.id!==id);save();close_();render()}}

/* MOVIMENTAÇÕES */
function mov(){return `<h2>Movimentações de estoque</h2><div class="card"><button class="b" onclick="mform()">+ Nova movimentação</button></div>
 <div class="card tw"><table><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="r">Qtd</th><th class="r">Saldo</th><th>Obs.</th></tr>
 ${db.moves.slice(0,200).map(m=>`<tr><td>${dt(m.t)}</td><td>${esc(m.name)}</td><td><span class="tag">${m.type}</span></td><td class="r ${m.qty<0?'dg':''}">${m.qty>0?'+':''}${N(m.qty)}</td><td class="r">${N(m.after)}</td><td class="mu">${esc(m.note)}</td></tr>`).join('')||'<tr><td colspan=6 class="mu">Sem movimentações.</td></tr>'}</table></div>`}
function mform(id){modal(`<h3>Movimentar estoque</h3><div class="f"><div class="w"><label>Produto</label><select id="m_p">${db.products.map(p=>`<option value="${p.id}" ${p.id===id?'selected':''}>${esc(p.name)} (${N(p.stock)})</option>`).join('')}</select></div>
 <div><label>Tipo</label><select id="m_t"><option value="entrada">Entrada (compra)</option><option value="saida">Saída manual</option><option value="perda">Perda / avaria</option><option value="ajuste">Ajuste (definir saldo)</option></select></div>
 <div><label>Quantidade</label><input id="m_q" type="number" step="any" min="0"></div><div class="w"><label>Observação</label><input id="m_o" placeholder="Ex.: NF 1234, fornecedor…"></div></div>
 <div class="row" style="margin-top:14px"><button class="b" onclick="msave()">Registrar</button><button class="s" onclick="close_()">Cancelar</button></div>`)}
function msave(){
 const p=P($('#m_p').value),t=$('#m_t').value,q=+$('#m_q').value;if(!p||!(q>=0)||$('#m_q').value===''){alert('Informe produto e quantidade.');return}
 let d=t==='entrada'?q:t==='ajuste'?q-p.stock:-q;
 if(p.stock+d<0){alert('Saldo ficaria negativo.');return}
 p.stock+=d;addMove(p.id,t,d,$('#m_o').value);save();close_();render();
}

/* VENDAS */
function vend(){return `<h2>Histórico de vendas</h2><div class="card tw"><table><tr><th>#</th><th>Data</th><th>Cliente</th><th>Operador</th><th>Itens</th><th>Pagamento</th><th class="r">Total</th><th class="r">Lucro</th><th></th></tr>
 ${db.sales.map(s=>`<tr style="${s.canceled?'opacity:.5;text-decoration:line-through':''}"><td>${s.n}</td><td>${dt(s.t)}</td><td>${esc(s.clientName||'—')}${s.ovr?` <span class="tag wn">limite autorizado por ${esc(s.ovr)}</span>`:''}${s.delivery?` <span class="tag ${s.delivery.status==='Entregue'?'':'wn'}">🚚 ${s.delivery.status}</span>`:''}</td><td>${esc(s.by||'—')}</td><td>${s.items.map(i=>i.q+'× '+esc(i.name)).join(', ').slice(0,60)}</td><td>${s.pay}</td><td class="r">${R(s.total)}</td><td class="r">${R(s.total-s.cost)}</td><td>${s.canceled?'<span class="tag">cancelada</span>':`<button class="s" onclick="receipt(db.sales.find(x=>x.id==='${s.id}'))">Ver</button> ${hasCarne(s)?`<button class="s" onclick="dlCarne('${s.id}')">Baixar carnê</button>`:`<button class="s" onclick="dlCupom('${s.id}')">Baixar cupom</button>`} ${s.delivery&&s.delivery.status!=='Entregue'?`<button class="s" onclick="deliv('${s.id}')">Entregue</button>`:''} ${me.role!=='caixa'?`<button class="s d" onclick="cancelSale('${s.id}')">Cancelar</button>`:''}`} ${me.role!=='caixa'?`<button class="s d" onclick="delSale('${s.id}')">Excluir</button>`:''}</td></tr>`).join('')||'<tr><td colspan=9 class="mu">Nenhuma venda.</td></tr>'}</table></div>`}
function cancelSale(id){const s=db.sales.find(x=>x.id===id);if(!confirm('Cancelar venda #'+s.n+' e devolver itens ao estoque? Os recebíveis (inclusive parcelas de crediário) também serão cancelados.'))return;
 s.canceled=true;db.ar.forEach(r=>{if(r.saleId===s.id)r.status='cancelado'});s.items.forEach(i=>{const p=P(i.id);if(p){p.stock+=i.q;addMove(p.id,'devolução',i.q,'Cancelamento venda #'+s.n)}});save();render()}

/* BACKUP */
function bkp(){return `<h2>Backup e dados</h2><div class="card"><p class="mu">${SB?'Os dados ficam salvos no Supabase.':'Os dados ficam salvos neste navegador.'} Copie o backup abaixo e guarde em um lugar seguro (e-mail, nuvem). Para restaurar, cole o texto e clique em Restaurar.</p>
 <textarea id="bk" rows="8" onfocus="this.select()">${esc(JSON.stringify(db))}</textarea>
 <div class="row" style="margin-top:10px"><button class="b" onclick="$('#bk').select();document.execCommand('copy');alert('Copiado!')">Copiar backup</button><button class="s" onclick="restore()">Restaurar do texto</button><button class="s" onclick="demo()">Carregar exemplo</button><button class="s d" onclick="wipe()">Apagar tudo</button></div></div>
 <div class="card"><h3>Dados da loja (aparecem no cupom)</h3><div class="f"><div class="w"><label>Nome da loja</label><input value="${esc(db.cfg.name)}" oninput="db.cfg.name=this.value;save()"></div><div><label>CNPJ/CPF</label><input value="${esc(db.cfg.doc)}" oninput="db.cfg.doc=this.value;save()"></div><div><label>Endereço</label><input value="${esc(db.cfg.addr)}" oninput="db.cfg.addr=this.value;save()"></div></div></div>
 <div class="card"><h3>Conexão com o Supabase</h3><p class="mu">${SB?'✅ Conectado ao Supabase.':'Modo local: os dados ficam só neste navegador.'} Passos: 1) copie o SQL e rode em Supabase › SQL Editor; 2) crie um usuário em Authentication › Users; 3) cole abaixo a URL e a chave anon public (Project Settings › API).</p><div class="row"><button class="s" onclick="copySql()">Copiar SQL do banco</button></div><div class="f" style="margin-top:10px"><div class="w"><label>Project URL</label><input id="sbu" placeholder="https://xxxx.supabase.co" value="${esc(SB?CFG.SUPABASE_URL:'')}"></div><div class="w"><label>Chave anon public</label><input id="sbk" placeholder="${SB?'(já configurada; cole outra para trocar)':'eyJ...'}"></div></div><div class="row" style="margin-top:10px"><button class="b" onclick="sbSave()">Salvar e conectar</button>${localStorage.getItem('sb_cfg')?'<button class="s d" onclick="sbOff()">Desconectar</button>':''}</div></div>
 <div class="card"><h3>Aparência</h3><div class="row"><button class="s" onclick="document.documentElement.dataset.theme='light'">Claro</button><button class="s" onclick="document.documentElement.dataset.theme='dark'">Escuro</button>${SB?'<button class="s" onclick="SB.auth.signOut().then(()=>location.reload())">Sair do Supabase</button>':''}</div></div>`}
function restore(){try{const d=JSON.parse($('#bk').value);if(!d.products||!d.sales||!d.moves)throw 0;d.clients=d.clients||[];d.nfes=d.nfes||[];d.cfg=d.cfg||{name:'',doc:'',addr:''};if(!d.users||!d.users.length)d.users=db.users;if(confirm('Substituir todos os dados atuais?')){db=d;db.ap=db.ap||[];db.ar=db.ar||[];ensureCfg();save();render()}}catch(e){alert('Texto de backup inválido.')}}
function wipe(){if(confirm('Apagar TODOS os dados? Isso não pode ser desfeito.')){db={products:[],sales:[],moves:[],clients:[],nfes:[],ap:[],ar:[],conf:[],promos:[],users:db.users,cfg:db.cfg};cart=[];save();render()}}
function demo(){if(db.products.length&&!confirm('Adicionar produtos de exemplo?'))return;
 [['Camiseta Básica','CAM001','Roupas',20,49.9,15,5],['Bermuda Jeans','BER001','Roupas',35,89.9,8,3],['Café 500g','CAF001','Mercearia',12,19.9,30,10],['Água 500ml','AGU001','Bebidas',0.8,3,60,20],['Fone Bluetooth','FON001','Eletrônicos',45,119.9,2,3]].forEach(([name,sku,cat,cost,price,e,min])=>{const p={id:uid(),name,sku:nextSku(),barcode:'789000'+(1000+db.products.length),cat,un:'un',cost,price,min,stock:e};db.products.push(p);addMove(p.id,'entrada',e,'Estoque inicial')});save();render()}
/* LOGIN */
function authView(){const first=!db.users.length;return `<div class="card" style="max-width:380px;margin:40px auto"><h2>${first?'Bem-vindo! Crie o administrador':'Entrar'}</h2><div class="f">${first?'<div class="w"><label>Nome</label><input id="a_n"></div>':''}<div><label>Login</label><input id="a_l" autocapitalize="off"></div><div><label>PIN / senha</label><input id="a_p" type="password" onkeydown="if(event.key===\'Enter\')${first?'firstUser':'login'}()"></div></div><button class="b" style="margin-top:12px" onclick="${first?'firstUser':'login'}()">${first?'Criar e entrar':'Entrar'}</button></div>`}
function firstUser(){const n=$('#a_n').value.trim(),l=$('#a_l').value.trim().toLowerCase(),p=$('#a_p').value;if(!n||!l||!p){alert('Preencha todos os campos.');return}if(!/^\d{4}$/.test(p)){alert('O PIN do administrador deve ter exatamente 4 dígitos numéricos.');return}me={id:uid(),name:n,login:l,pin:p,role:'admin'};db.users.push(me);save();render()}
function login(){const l=$('#a_l').value.trim().toLowerCase(),p=$('#a_p').value,u=db.users.find(u=>u.login===l&&u.pin===p);if(!u){alert('Login ou senha incorretos.');return}me=u;render()}
/* CUPOM */
function cupomHtml(s){const c=db.cfg,L=s.items.map(i=>`<tr><td colspan=2>${esc(i.name)}</td></tr><tr><td>${i.q} x ${R(i.price)}</td><td class="r">${R(i.q*i.price)}</td></tr>`).join('');
 return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cupom ${s.n}</title><style>body{font:13px monospace;max-width:300px;margin:10px auto;color:#000}hr{border:0;border-top:1px dashed #000}td{padding:1px 0}.r{text-align:right}</style></head><body><center><b>${esc(c.name||'MINHA LOJA')}</b><br>${c.doc?'CNPJ/CPF: '+esc(c.doc)+'<br>':''}${esc(c.addr)}<br><b>CUPOM NÃO FISCAL</b></center><hr>Venda #${s.n} · ${dt(s.t)}<br>Operador: ${esc(s.by||'-')}<br>Cliente: ${esc(s.clientName||'Consumidor')}<hr><table width="100%">${L}</table><hr><table width="100%">${s.disc?`<tr><td>Desconto</td><td class="r">-${R(s.disc)}</td></tr>`:''}${s.fee?`<tr><td>Taxa de entrega</td><td class="r">${R(s.fee)}</td></tr>`:''}<tr><td><b>TOTAL</b></td><td class="r"><b>${R(s.total)}</b></td></tr>${payRows(s)}${s.troco?`<tr><td>Troco</td><td class="r">${R(s.troco)}</td></tr>`:''}</table>${s.delivery?`<hr>ENTREGA<br>${esc(s.delivery.name)} ${esc(s.delivery.phone)}<br>${esc(s.delivery.addr)}<br>${esc(s.delivery.notes)}`:''}<hr><center>Obrigado pela preferência!</center></body></html>`}
async function dlCupom(id){const s=db.sales.find(x=>x.id===id);await saveFile('cupom-'+s.n+'.html',cupomHtml(s),'text/html')}
function receipt(s){modal(`<h3>Venda #${s.n}${s.canceled?' (cancelada)':' concluída ✅'}</h3><div class="mu">${dt(s.t)} · ${s.pay} · ${esc(s.clientName||'Consumidor')} · ${esc(s.by||'')}</div><table style="margin:10px 0">${s.items.map(i=>`<tr><td>${i.q}× ${esc(i.name)}</td><td class="r">${R(i.q*i.price)}</td></tr>`).join('')}${s.disc?`<tr><td>Desconto</td><td class="r">−${R(s.disc)}</td></tr>`:''}${s.fee?`<tr><td>Entrega</td><td class="r">${R(s.fee)}</td></tr>`:''}<tr><td><b>Total</b></td><td class="r"><b>${R(s.total)}</b></td></tr>${payRows(s)}${s.troco?`<tr><td>Troco</td><td class="r">${R(s.troco)}</td></tr>`:''}</table>${s.delivery?`<p style="margin:0 0 8px">🚚 <b>${esc(s.delivery.status)}</b> · ${esc(s.delivery.name)} ${esc(s.delivery.phone)}<br>${esc(s.delivery.addr)}<br><span class="mu">${esc(s.delivery.notes)}</span></p>`:''}<p class="mu" style="font-size:12px">Cupom não fiscal (sem valor tributário).</p><div class="row">${hasCarne(s)?`<button class="b" onclick="dlCarne('${s.id}')">Baixar carnê (PDF)</button>`:`<button class="b" onclick="dlCupom('${s.id}')">Baixar cupom</button>`}<button class="s" onclick="window.print()">Imprimir</button><button class="s" onclick="close_()">Fechar</button></div>`)}
/* CLIENTES */
let cq='';
function cli(){const t=cq.toLowerCase(),st={};db.sales.filter(s=>!s.canceled&&s.clientId).forEach(s=>{const x=st[s.clientId]=st[s.clientId]||{n:0,v:0,l:0};x.n++;x.v+=s.total;x.l=Math.max(x.l,s.t)});
 const l=db.clients.filter(c=>!t||[c.name,c.doc,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(t)));
 return `<h2>Clientes</h2><div class="card"><div class="row"><input id="cq" placeholder="Buscar nome, CPF/CNPJ, telefone…" value="${esc(cq)}" oninput="cq=this.value;render();rf('cq')"><button class="b" onclick="cform()">+ Novo cliente</button></div></div><div class="card tw"><table><tr><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th class="r">Compras</th><th class="r">Total gasto</th><th class="r">Limite crediário</th><th class="r">Disponível</th><th>Última</th><th></th></tr>
 ${l.map(c=>{const x=st[c.id]||{n:0,v:0,l:0};return `<tr><td>${esc(c.name)}<br><small class="mu">${esc(c.email)}</small></td><td>${esc(c.doc)}</td><td>${esc(c.phone)}</td><td class="r">${x.n}</td><td class="r">${R(x.v)}</td><td class="r">${R(c.limit)}</td><td class="r">${R(credAvail(c.id))}</td><td>${x.l?dt(x.l):'—'}</td><td><button class="s" onclick="cform('${c.id}')">Editar</button></td></tr>`}).join('')||'<tr><td colspan=9 class="mu">Nenhum cliente cadastrado.</td></tr>'}</table></div>`}
function cform(id){const c=id?db.clients.find(x=>x.id===id):{};modal(`<h3>${id?'Editar':'Novo'} cliente</h3><div class="f"><div class="w"><label>Nome *</label><input id="c_n" value="${esc(c.name)}"></div><div><label>CPF/CNPJ</label><input id="c_d" value="${esc(c.doc)}"></div><div><label>Telefone</label><input id="c_t" value="${esc(c.phone)}"></div><div class="w"><label>E-mail</label><input id="c_e" value="${esc(c.email)}"></div><div class="w"><label>Endereço</label><input id="c_a" value="${esc(c.addr)}"></div><div class="w"><label>Limite de crediário (R$) — 0 = sem crediário</label><input id="c_l" type="number" min="0" step="0.01" value="${c.limit||''}"></div><div class="w"><label>Observações</label><textarea id="c_o" rows="2">${esc(c.notes)}</textarea></div></div><div class="row" style="margin-top:14px"><button class="b" onclick="csave('${id||''}')">Salvar</button><button class="s" onclick="close_()">Cancelar</button>${id?`<button class="s d" onclick="cdel('${id}')">Excluir</button>`:''}</div>`)}
function csave(id){const g=k=>$('#c_'+k).value.trim(),name=g('n');if(!name){alert('Informe o nome.');return}const d={name,doc:g('d'),phone:g('t'),email:g('e'),addr:g('a'),notes:g('o'),limit:+$('#c_l').value||0};if(id)Object.assign(db.clients.find(x=>x.id===id),d);else db.clients.push({id:uid(),...d});save();close_();render()}
function cdel(id){if(confirm('Excluir este cliente? As vendas dele continuam no histórico.')){db.clients=db.clients.filter(c=>c.id!==id);save();close_();render()}}
/* USUÁRIOS */
function usr(){const vc={};db.sales.filter(s=>!s.canceled).forEach(s=>vc[s.byId]=(vc[s.byId]||0)+1);
 return `<h2>Usuários</h2><div class="card"><button class="b" onclick="uform()">+ Novo usuário</button><p class="mu" style="margin-bottom:0">Administrador: acesso total · Gerente: tudo, exceto usuários e backup · Caixa: PDV, clientes e vendas (sem cancelar).</p></div><div class="card tw"><table><tr><th>Nome</th><th>Login</th><th>Perfil</th><th class="r">Vendas</th><th></th></tr>${db.users.map(u=>`<tr><td>${esc(u.name)}${u.id===me.id?' <span class="tag">você</span>':''}</td><td>${esc(u.login)}</td><td><span class="tag">${ROLE[u.role]}</span></td><td class="r">${vc[u.id]||0}</td><td><button class="s" onclick="uform('${u.id}')">Editar</button></td></tr>`).join('')}</table></div>`}
function uform(id){const u=id?db.users.find(x=>x.id===id):{role:'caixa'};modal(`<h3>${id?'Editar':'Novo'} usuário</h3><div class="f"><div class="w"><label>Nome *</label><input id="u_n" value="${esc(u.name)}"></div><div><label>Login *</label><input id="u_l" autocapitalize="off" value="${esc(u.login)}"></div><div><label>${id?'Novo PIN (vazio = manter)':'PIN / senha *'}</label><input id="u_p" type="password"></div><div class="w"><label>Perfil</label><select id="u_r">${Object.entries(ROLE).map(([k,v])=>`<option value="${k}" ${k===u.role?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="row" style="margin-top:14px"><button class="b" onclick="usave('${id||''}')">Salvar</button><button class="s" onclick="close_()">Cancelar</button>${id&&id!==me.id?`<button class="s d" onclick="udel('${id}')">Excluir</button>`:''}</div>`)}
const admins=()=>db.users.filter(u=>u.role==='admin').length;
function usave(id){const n=$('#u_n').value.trim(),l=$('#u_l').value.trim().toLowerCase(),p=$('#u_p').value,r=$('#u_r').value;
 if(!n||!l||(!id&&!p)){alert('Preencha nome, login e PIN.');return}
 if(r==='admin'&&!/^\d{4}$/.test(p||(id?db.users.find(x=>x.id===id).pin:''))){alert('O PIN do administrador deve ter exatamente 4 dígitos numéricos. Informe um novo PIN.');return}
 if(db.users.some(u=>u.login===l&&u.id!==id)){alert('Esse login já existe.');return}
 if(id){const u=db.users.find(x=>x.id===id);if(u.role==='admin'&&r!=='admin'&&admins()<2){alert('Mantenha pelo menos um administrador.');return}Object.assign(u,{name:n,login:l,role:r});if(p)u.pin=p}
 else db.users.push({id:uid(),name:n,login:l,pin:p,role:r});save();close_();render()}
function udel(id){const u=db.users.find(x=>x.id===id);if(u.role==='admin'&&admins()<2){alert('Mantenha pelo menos um administrador.');return}if(confirm('Excluir o usuário '+u.name+'?')){db.users=db.users.filter(x=>x.id!==id);save();close_();render()}}
/* PDV: pagamentos, entrega, finalização */
const sub=()=>cart.reduce((a,c)=>a+lt(c).t,0),fee=()=>dlv.on?(+dlv.fee||0):0,tot=()=>Math.max(0,sub()-disc)+fee(),paid=()=>pays.reduce((a,p)=>a+p.v,0);
const payTxt=p=>p.m+(p.par>1?' '+p.par+'x de '+R(p.v/p.par):'');
function payRows(s){return (s.pays||[{m:s.pay,v:s.total,par:1}]).map(p=>`<tr><td>${esc(payTxt(p))}</td><td class="r">${R(p.v)}</td></tr>`).join('')}
function payHtml(){const rest=Math.max(0,tot()-paid());return `<label>Formas de pagamento</label>${pays.map((p,i)=>`<div class="row" style="margin-bottom:4px"><span>${esc(payTxt(p))}</span><b style="text-align:right">${R(p.v)}</b><button class="s d" onclick="pays.splice(${i},1);payUI()">✕</button></div>`).join('')}
 <div class="row"><select id="pm" onchange="pmCh()"><option>Dinheiro</option><option>Pix</option><option>Cartão débito</option><option>Cartão crédito</option><option>Crediário</option></select><select id="pp" style="display:none">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}x${i?'':' (à vista)'}</option>`).join('')}</select></div>
 ${curCli?`<p class="mu" style="margin:4px 0">Limite de crediário disponível: <b>${R(credAvail(curCli))}</b></p>`:''}<div class="row" style="margin-top:6px"><input id="pv" type="number" min="0" step="0.01" placeholder="Valor (vazio = restante ${R(rest)})"><button class="s" onclick="addPay()">+ Adicionar</button></div>`}
const payUI=()=>{$('#pa').innerHTML=payHtml();sumUI()};
function sumHtml(){const t=tot(),pd=paid();return `<span class="mu">Subtotal ${R(sub())}${disc?' · Desconto −'+R(disc):''}${fee()?' · Entrega '+R(fee()):''}</span><div class="tot">${R(t)}</div><div class="${pd>=t-0.005&&cart.length?'':'wn'}">${pd<t-0.005?'Faltam '+R(t-pd):pd>t+0.005?'Troco: '+R(pd-t):'Pagamento completo ✔'}</div>`}
function sumUI(){const e=$('#sm');if(!e)return;e.innerHTML=sumHtml();const p=$('#pv');if(p)p.placeholder='Valor (vazio = restante '+R(Math.max(0,tot()-paid()))+')'}
function pmCh(){$('#pp').style.display=['Cartão crédito','Crediário'].includes($('#pm').value)?'':'none'}
function addPay(){const m=$('#pm').value,rest=+(tot()-paid()).toFixed(2),raw=$('#pv').value;let v=raw===''?rest:+raw;
 if(!cart.length){alert('Adicione produtos ao carrinho primeiro.');return}
 if(!(v>0)){alert(rest<=0?'O total já está coberto.':'Informe um valor válido.');return}
 if(m==='Crediário'){if(!curCli){alert('Crediário só é permitido com cliente identificado. Selecione o cliente.');return}const av=credAvail(curCli)-pays.filter(p=>p.m==='Crediário').reduce((a,p)=>a+p.v,0);if(v>rest+0.005){alert('Valor maior que o restante ('+R(rest)+').');return}
  if(v>av+0.005){const vv=+v.toFixed(2),par=+$('#pp').value;askAdmin('Limite de crediário insuficiente (disponível '+R(Math.max(0,av))+'). Para vender acima do limite, informe a senha de 4 dígitos do administrador.',who=>{pays.push({m,v:vv,par,ov:who});payUI()});return}}
 if(m!=='Dinheiro'&&v>rest+0.005){alert('Valor maior que o restante ('+R(rest)+'). Só dinheiro pode gerar troco.');return}
 pays.push({m,v:+v.toFixed(2),par:m==='Cartão crédito'||m==='Crediário'?+$('#pp').value:1});payUI()}
function setCli(v){if(v!==curCli&&pays.some(p=>p.m==='Crediário')){pays=pays.filter(p=>p.m!=='Crediário');alert('Parcelas de crediário removidas porque o cliente mudou.')}curCli=v;const c=db.clients.find(x=>x.id===v);if(c&&dlv.on){dlv.name=dlv.name||c.name;dlv.phone=dlv.phone||c.phone;dlv.addr=dlv.addr||c.addr}render()}
function togDlv(v){dlv.on=v?1:0;setCli(curCli)}
function finish(){
 const t=tot(),pd=paid();if(!cart.length)return;
 if(pd<t-0.005){alert('Pagamento incompleto. Faltam '+R(t-pd));return}
 const cash=pays.filter(p=>p.m==='Dinheiro').reduce((a,p)=>a+p.v,0),troco=Math.max(0,+(pd-t).toFixed(2));
 if(troco>cash+0.005){alert('O troco não pode ser maior que o valor pago em dinheiro.');return}
 const cr=pays.filter(p=>p.m==='Crediário').reduce((a,p)=>a+p.v,0);if(cr){if(!curCli){alert('Crediário exige cliente identificado.');return}if(cr>credAvail(curCli)+0.005&&!pays.some(p=>p.ov)){alert('Limite de crediário insuficiente.');return}}
 if(dlv.on&&!dlv.addr.trim()){alert('Informe o endereço da entrega.');return}
 if(cart.some(c=>P(c.id).hold)){alert('Há produto travado aguardando conferência de preço.');return}
 for(const c of cart)if(c.q>P(c.id).stock){alert('Estoque insuficiente: '+P(c.id).name);return}
 const items=cart.map(c=>{const p=P(c.id),x=lt(c);return{id:p.id,name:p.name,q:c.q,price:+(x.t/c.q).toFixed(4),cost:p.cost,promo:x.promo?x.promo.name:'',orig:p.price}});
 const sale={id:uid(),n:db.sales.reduce((a,x)=>Math.max(a,x.n||0),0)+1,t:Date.now(),items,disc,fee:fee(),total:t,cost:items.reduce((a,i)=>a+i.cost*i.q,0),pays:pays.map(p=>({...p})),pay:pays.map(p=>p.m+(p.par>1?' '+p.par+'x':'')).join(' + '),clientId:curCli,clientName:(db.clients.find(c=>c.id===curCli)||{}).name||'',by:me.name,byId:me.id,troco,delivery:dlv.on?{...dlv,status:'Pendente'}:null,ovr:(pays.find(p=>p.ov)||{}).ov||''};
 cart.forEach(c=>{const p=P(c.id);p.stock-=c.q;addMove(p.id,'venda',-c.q,'Venda #'+sale.n)});
 db.sales.unshift(sale);db.ar.push(...arFromSale(sale));save();cart=[];q='';curCli='';pays=[];disc=0;dlv=newDlv();render();receipt(sale);if(hasCarne(sale))dlCarne(sale.id);
}
function deliv(id){const s=db.sales.find(x=>x.id===id);if(s&&s.delivery){s.delivery.status='Entregue';save();render()}}
/* ENTRADA VIA NF-E */
const T=(e,t)=>{if(!e)return '';const x=e.getElementsByTagName(t)[0];return x?x.textContent.trim():''};
const cfopV=c=>/40[35]$/.test(c)?'5405':'5102';
function parseNfe(x){
 const d=new DOMParser().parseFromString(x,'text/xml'),inf=d.getElementsByTagName('infNFe')[0];
 if(d.getElementsByTagName('parsererror').length||!inf)throw 0;
 const em=d.getElementsByTagName('emit')[0];
 const items=[...d.getElementsByTagName('det')].map(det=>{
  const pr=det.getElementsByTagName('prod')[0],im=det.getElementsByTagName('imposto')[0],g=n=>{const e=im&&im.getElementsByTagName(n)[0];return e?e.firstElementChild:null};
  const ic=g('ICMS'),pi=g('PIS'),co=g('COFINS'),q=+T(pr,'qCom')||0,ean=T(pr,'cEAN');
  const tt=(+T(pr,'vProd')||0)+(+T(pr,'vFrete')||0)+(+T(pr,'vSeg')||0)+(+T(pr,'vOutro')||0)-(+T(pr,'vDesc')||0);
  return{cod:T(pr,'cProd'),ean:/^\d{8,14}$/.test(ean)?ean:'',name:T(pr,'xProd'),ncm:T(pr,'NCM'),cest:T(pr,'CEST'),cfop:T(pr,'CFOP'),un:T(pr,'uCom'),q,cost:q?+(tt/q).toFixed(4):0,orig:T(ic,'orig'),icms:T(ic,'CST')||T(ic,'CSOSN'),icmsA:T(ic,'pICMS'),pis:T(pi,'CST'),cof:T(co,'CST')}});
 if(!items.length)throw 0;
 let dups=[...d.getElementsByTagName('dup')].map(x=>({nDup:T(x,'nDup'),venc:T(x,'dVenc'),v:+T(x,'vDup')||0})),semDup=false;
 if(!dups.length){semDup=true;dups=[{nDup:'001',venc:(T(d,'dhEmi')||T(d,'dEmi')).slice(0,10),v:+T(d,'vNF')||0}]}
 return{chave:(inf.getAttribute('Id')||'').replace(/\D/g,''),num:T(d,'nNF'),serie:T(d,'serie'),emit:T(em,'xNome'),cnpj:T(em,'CNPJ')||T(em,'CPF'),dt:T(d,'dhEmi')||T(d,'dEmi'),total:+T(d,'vNF')||0,items,dups,semDup}}
function matchP(it,cnpj){const n=it.name.toLowerCase();return db.products.find(p=>(it.ean&&p.barcode===it.ean)||(p.sup&&p.sup[cnpj+'|'+it.cod])||p.name.toLowerCase()===n)}
function nfeFile(f){if(!f)return;const r=new FileReader();r.onload=()=>nfeParse(r.result);r.readAsText(f)}
function nfeParse(x){try{const n=parseNfe(x);if(n.chave&&db.nfes.some(z=>z.chave===n.chave&&!z.canceled)){alert('Esta NF-e já foi lançada.');return}
 const mk=db.cfg.markup??50;n.items.forEach(it=>{const p=matchP(it,n.cnpj);it.pid=p?p.id:'';it.inc=true;it.updP=false;it.price=p?p.price:+(it.cost*(1+mk/100)).toFixed(2);it.cfopV=cfopV(it.cfop)});n.dups.forEach(d=>d.inc=true);nf=n;render()}catch(e){alert('Não consegui ler este XML. Use o XML de uma NF-e (modelo 55).')}}
function nfRecalc(){const mk=db.cfg.markup??50;nf.items.forEach(it=>{if(!it.pid)it.price=+(it.cost*(1+mk/100)).toFixed(2)});render()}
function nfe(){return `<h2>Entrada via NF-e</h2><div class="card"><p class="mu" style="margin-top:0">Importe o XML da nota de compra. O sistema lê fornecedor, itens, custo (com frete, seguro, outras despesas e descontos rateados) e tributação (NCM, CFOP, ICMS, PIS, COFINS), sugere o cadastro e dá entrada no estoque.</p>
 <div class="f"><div><label>Arquivo XML da NF-e</label><input type="file" accept=".xml,text/xml,application/xml" onchange="nfeFile(this.files[0])"></div><div><label>Margem sugerida sobre o custo (%)</label><input type="number" min="0" value="${db.cfg.markup??50}" oninput="db.cfg.markup=+this.value||0;save()"></div><div class="w"><label>Ou cole o conteúdo do XML</label><textarea id="nx" rows="3"></textarea></div></div>
 <div class="row" style="margin-top:10px"><button class="b" onclick="nfeParse($('#nx').value)">Ler XML colado</button>${nf?'<button class="s" onclick="nfRecalc()">Recalcular preços dos novos</button>':''}</div></div>
 ${nf?nfPrev():''}<div class="card tw"><h3>NF-e já lançadas</h3><table><tr><th>Lançada em</th><th>NF</th><th>Fornecedor</th><th class="r">Itens</th><th class="r">Total</th><th>Por</th><th></th></tr>${db.nfes.map(z=>`<tr><td>${dt(z.t)}</td><td>${esc(z.num)}${z.serie?'/'+esc(z.serie):''}</td><td>${esc(z.emit)}</td><td class="r">${z.n}</td><td class="r">${R(z.total)}</td><td>${esc(z.by)}</td><td>${z.canceled?'<span class="tag">Cancelada</span>':`<button class="s d" onclick="nfeCancel('${z.id}')">Cancelar entrada</button>`}</td></tr>`).join('')||'<tr><td colspan=7 class="mu">Nenhuma ainda.</td></tr>'}</table></div>`}
function nfPrev(){const n=nf;return `<div class="card"><h3>NF-e ${esc(n.num)}${n.serie?'/'+esc(n.serie):''} · ${esc(n.emit)}</h3><p class="mu">CNPJ ${esc(n.cnpj)} · ${esc(n.dt.slice(0,10))} · Total da nota ${R(n.total)}</p><div class="tw"><table><tr><th></th><th>Produto</th><th class="r">Qtd</th><th class="r">Custo un.</th><th>Preço de venda</th><th>Tributação sugerida</th><th>Situação</th></tr>
 ${n.items.map((it,i)=>{const p=it.pid&&P(it.pid);return `<tr><td><input type="checkbox" style="width:auto" ${it.inc?'checked':''} onchange="nf.items[${i}].inc=this.checked"></td><td>${p?esc(p.name)+'<br><small class="mu">'+esc(it.name)+'</small>':`<input style="min-width:190px" value="${esc(it.name)}" oninput="nf.items[${i}].name=this.value">`}</td><td class="r">${N(it.q)} ${esc(it.un)}</td><td class="r">${R(it.cost)}${p?`<br><small class="${it.cost>p.cost?'dg':'mu'}">antes ${R(p.cost)}</small>`:''}</td><td>${p?`<label style="display:flex;gap:4px;align-items:center;font-size:12px"><input type="checkbox" style="width:auto" ${it.updP?'checked':''} onchange="nf.items[${i}].updP=this.checked"> atualizar (hoje ${R(p.price)})</label>`:''}<input type="number" step="0.01" style="min-width:90px" value="${it.price}" oninput="nf.items[${i}].price=+this.value"></td><td><small>NCM ${esc(it.ncm)||'—'} · CFOP venda ${it.cfopV}<br>ICMS ${esc(it.icms)||'—'}${it.icmsA?' '+esc(it.icmsA)+'%':''} · PIS ${esc(it.pis)||'—'} · COFINS ${esc(it.cof)||'—'}</small></td><td>${p?'<span class="tag">Cadastrado</span>':'<span class="tag wn">Novo produto</span>'}</td></tr>`}).join('')}</table></div>
 <h3 style="margin-top:16px">💳 Contas a pagar (duplicatas/boletos do XML)</h3>${n.semDup?'<p class="wn">O XML não traz duplicatas. Ajuste o vencimento ou desmarque se a nota já foi paga.</p>':''}<div class="tw"><table><tr><th></th><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr>${n.dups.map((d,i)=>`<tr><td><input type="checkbox" style="width:auto" ${d.inc?'checked':''} onchange="nf.dups[${i}].inc=this.checked"></td><td>${esc(d.nDup)}</td><td><input type="date" style="min-width:140px" value="${d.venc}" oninput="nf.dups[${i}].venc=this.value"></td><td><input type="number" step="0.01" style="min-width:100px" value="${d.v}" oninput="nf.dups[${i}].v=+this.value"></td></tr>`).join('')}</table></div>
 <div class="row" style="margin-top:12px"><button class="b" onclick="nfeReview()">Revisar lançamento</button><button class="s" onclick="nf=null;render()">Cancelar</button></div></div>`}
function nfeConfirm(){const n=nf,sel=n.items.filter(i=>i.inc&&i.q>0);if(!sel.length){alert('Selecione ao menos um item.');return}
 if(sel.some(i=>!i.pid&&!i.name.trim())){alert('Há produto novo sem nome.');return}
 let nw=0,up=0;const mv=[],rid=uid();
 sel.forEach(it=>{let p=it.pid&&P(it.pid);const co=p?p.cost:null,po=p?p.price:null,fis={ncm:it.ncm,cest:it.cest,orig:it.orig,cfop:it.cfopV,icms:it.icms,icmsA:it.icmsA,pis:it.pis,cof:it.cof};
  if(!p){p={id:uid(),name:it.name.trim(),sku:nextSku(),barcode:it.ean&&!db.products.some(x=>x.barcode===it.ean)?it.ean:'',cat:'',un:(it.un||'un').toLowerCase(),cost:it.cost,price:it.price,min:5,stock:0,fis,sup:{}};db.products.push(p);nw++}
  else{p.cost=it.cost;if(it.updP&&it.price>0)p.price=it.price;if(!p.fis||!p.fis.ncm)p.fis=fis;if(!p.barcode&&it.ean)p.barcode=it.ean;up++}
  (p.sup=p.sup||{})[n.cnpj+'|'+it.cod]=1;p.stock+=it.q;mv.push({pid:p.id,q:it.q});confAdd(p,it,n,rid,co,po);addMove(p.id,'entrada',it.q,'NF-e '+n.num+' · '+n.emit)});
 db.nfes.unshift({id:rid,t:Date.now(),chave:n.chave,num:n.num,serie:n.serie,emit:n.emit,cnpj:n.cnpj,dt:n.dt,total:n.total,n:sel.length,by:me.name,mv});
 const dp=n.dups.filter(d=>d.inc);dp.forEach(d=>db.ap.push({id:uid(),party:n.emit,cnpj:n.cnpj,desc:'NF-e '+n.num+' · parcela '+d.nDup,nfe:n.num,nfid:rid,chave:n.chave,v:+d.v,due:d.venc,status:'aberto',t:Date.now()}));
 save();nf=null;close_();render();alert('NF-e lançada: '+nw+' novo(s), '+up+' atualizado(s), '+dp.length+' conta(s) a pagar. Os produtos estão travados até a conferência de preços.');go('conf')}
/* FINANCEIRO */
function defFees(){return{Dinheiro:{p:0,d:0},Pix:{p:0,d:0},'Cartão débito':{p:0,d:1},credD:30,cred:Array(12).fill(0)}}
function ensureCfg(){db.cfg.fees=db.cfg.fees||defFees();db.cfg.late=db.cfg.late||{mul:2,jur:0.033};db.cfg.carne=db.cfg.carne||{d1:30,di:30};db.conf=db.conf||[];db.promos=db.promos||[];if(db.cfg.minMargin==null)db.cfg.minMargin=10}
ensureCfg();
const ymd=d=>{const z=new Date(d);return z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')+'-'+String(z.getDate()).padStart(2,'0')};
const addDays=(s,n)=>{const [y,m,d]=s.split('-').map(Number);return ymd(new Date(y,m-1,d+n))};
const fd=s=>s?s.split('-').reverse().join('/'):'—',today=()=>ymd(Date.now());
const isLate=x=>x.status==='aberto'&&x.due<today();
const stTag=(x,ar)=>x.status==='pago'?`<span class="tag">${ar?'Recebido':'Pago'}</span>`:x.status==='cancelado'?'<span class="tag">Cancelado</span>':isLate(x)?'<span class="tag dg">Vencido</span>':'<span class="tag wn">Em aberto</span>';
function arFromSale(sale){const F=db.cfg.fees,td=ymd(sale.t);let tr=sale.troco||0;const out=[];
 sale.pays.forEach(p=>{let v=p.v;if(p.m==='Dinheiro'){const d=Math.min(tr,v);tr-=d;v-=d}
  if(v<=0)return;const base={saleId:sale.id,saleN:sale.n,cli:sale.clientName,cid:sale.clientId,method:p.m,status:'aberto'};
  if(p.m==='Crediário'){const n=p.par||1,C=db.cfg.carne;let gA=0;for(let i=1;i<=n;i++){const g=i<n?+(v/n).toFixed(2):+(v-gA).toFixed(2);gA+=g;out.push({...base,id:uid(),n:i,of:n,desc:'Venda #'+sale.n+' · Crediário '+i+'/'+n,gross:g,fee:0,net:g,due:addDays(td,C.d1+C.di*(i-1))})}}
  else if(p.m==='Cartão crédito'){const n=p.par||1,pct=+F.cred[n-1]||0,feeT=+(v*pct/100).toFixed(2);let gA=0,fA=0;
   for(let i=1;i<=n;i++){const g=i<n?+(v/n).toFixed(2):+(v-gA).toFixed(2),fe=i<n?+(feeT/n).toFixed(2):+(feeT-fA).toFixed(2);gA+=g;fA+=fe;out.push({...base,id:uid(),desc:'Venda #'+sale.n+' · Crédito '+i+'/'+n,gross:g,fee:fe,net:+(g-fe).toFixed(2),due:addDays(td,F.credD*i)})}}
  else{const r=F[p.m]||{p:0,d:0},fe=+(v*r.p/100).toFixed(2);out.push({...base,id:uid(),desc:'Venda #'+sale.n+' · '+p.m,gross:v,fee:fe,net:+(v-fe).toFixed(2),due:addDays(td,r.d)})}});
 out.forEach(r=>{r.t=sale.t;if(r.due<=td&&(r.method==='Dinheiro'||r.method==='Pix')){r.status='pago';r.paidAt=td}});return out}
let fsub='res',ff={ap:'aberto',ar:'aberto',m:''},fq='';
function fin(){const sb=[['res','Resumo'],['ap','Contas a pagar'],['ar','Contas a receber'],['tx','Taxas de pagamento']];
 return `<h2>Financeiro</h2><div class="row" style="margin-bottom:12px">${sb.map(([k,n])=>`<button class="${fsub===k?'b':'s'}" onclick="fsub='${k}';render()">${n}</button>`).join('')}</div>${({res:finRes,ap:finAP,ar:finAR,tx:finTx})[fsub]()}`}
function finRes(){const mo=today().slice(0,7),op=x=>x.status==='aberto',sm=(l,f)=>l.reduce((a,x)=>a+f(x),0);
 const apO=db.ap.filter(op),arO=db.ar.filter(op),arM=db.ar.filter(x=>x.status!=='cancelado'&&ymd(x.t).startsWith(mo));
 const K=(l,v,c)=>`<div class="card kpi"><small>${l}</small><b class="${c||''}">${R(v)}</b></div>`;
 const up=[...apO.map(x=>({...x,k:'Pagar',a:x.v,who:x.party})),...arO.map(x=>({...x,k:'Receber',a:x.net,who:x.desc}))].sort((a,b)=>a.due<b.due?-1:1).slice(0,10);
 return `<div class="grid">${K('A pagar (em aberto)',sm(apO,x=>x.v))}${K('Vencido a pagar',sm(apO.filter(isLate),x=>x.v),'dg')}${K('A receber (líquido)',sm(arO,x=>x.net))}${K('Vencido a receber',sm(arO.filter(isLate),x=>x.net),'wn')}${K('Saldo previsto',sm(arO,x=>x.net)-sm(apO,x=>x.v))}${K('Taxas de pagamento no mês',sm(arM,x=>x.fee))}${K('Recebido no mês',sm(db.ar.filter(x=>x.status==='pago'&&(x.paidAt||'').startsWith(mo)),x=>x.net+(x.extra||0)))}${K('Pago no mês',sm(db.ap.filter(x=>x.status==='pago'&&(x.paidAt||'').startsWith(mo)),x=>x.paidV||x.v))}</div>
 <div class="card tw"><h3>Próximos vencimentos</h3><table>${up.map(x=>`<tr><td>${fd(x.due)}</td><td><span class="tag">${x.k}</span></td><td>${esc(x.who)}</td><td class="r">${R(x.a)}</td><td>${stTag(x,x.k==='Receber')}</td></tr>`).join('')||'<tr><td class="mu">Nada em aberto.</td></tr>'}</table></div>`}
const fOpts=(k)=>[['aberto','Em aberto'],['vencido','Vencidas'],['pago','Pagas/Recebidas'],['todos','Todas']].map(([v,n])=>`<option value="${v}" ${ff[k]===v?'selected':''}>${n}</option>`).join('');
const fFil=(x,f)=>f==='todos'||(f==='aberto'?x.status==='aberto':f==='vencido'?isLate(x):x.status==='pago');
function finAP(){const t=fq.toLowerCase(),l=db.ap.filter(x=>x.status!=='cancelado'&&fFil(x,ff.ap)&&(!t||[x.party,x.desc,x.nfe].some(v=>String(v||'').toLowerCase().includes(t)))).sort((a,b)=>a.due<b.due?-1:1);
 return `<div class="card"><div class="row"><input id="fq" placeholder="Buscar fornecedor, NF…" value="${esc(fq)}" oninput="fq=this.value;render();rf('fq')"><select onchange="ff.ap=this.value;render()">${fOpts('ap')}</select><button class="b" onclick="apForm()">+ Nova conta a pagar</button></div></div>
 <div class="card tw"><table><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th class="r">Valor</th><th>Status</th><th></th></tr>${l.map(x=>`<tr><td>${fd(x.due)}</td><td>${esc(x.party)}</td><td>${esc(x.desc)}${x.bar?'<br><small class="mu">'+esc(x.bar)+'</small>':''}</td><td class="r">${R(x.v)}</td><td>${stTag(x)}${x.paidAt?'<br><small class="mu">'+fd(x.paidAt)+'</small>':''}</td><td>${x.status==='aberto'?`<button class="s" onclick="settle('ap','${x.id}')">Pagar</button> <button class="s" onclick="apForm('${x.id}')">Editar</button>`:`<button class="s" onclick="unsettle('ap','${x.id}')">Estornar</button>`} <button class="s d" onclick="finDel('ap','${x.id}')">✕</button></td></tr>`).join('')||'<tr><td colspan=6 class="mu">Nada por aqui.</td></tr>'}<tr><td colspan=3 class="r"><b>Total</b></td><td class="r"><b>${R(l.reduce((a,x)=>a+x.v,0))}</b></td><td colspan=2></td></tr></table></div>`}
function finAR(){const t=fq.toLowerCase(),l=db.ar.filter(x=>x.status!=='cancelado'&&fFil(x,ff.ar)&&(!ff.m||x.method===ff.m)&&(!t||[x.desc,x.cli].some(v=>String(v||'').toLowerCase().includes(t)))).sort((a,b)=>a.due<b.due?-1:1),S=k=>l.reduce((a,x)=>a+x[k],0);
 return `<div class="card"><div class="row"><input id="fq" placeholder="Buscar venda ou cliente…" value="${esc(fq)}" oninput="fq=this.value;render();rf('fq')"><select onchange="ff.ar=this.value;render()">${fOpts('ar')}</select><select onchange="ff.m=this.value;render()">${['','Dinheiro','Pix','Cartão débito','Cartão crédito','Crediário','Outros'].map(m=>`<option value="${m}" ${ff.m===m?'selected':''}>${m||'Todas as formas'}</option>`).join('')}</select><button class="b" onclick="arForm()">+ Nova conta a receber</button></div></div>
 <div class="card tw"><table><tr><th>Vencimento</th><th>Descrição</th><th>Forma</th><th class="r">Bruto</th><th class="r">Taxa</th><th class="r">Líquido</th><th>Status</th><th></th></tr>${l.map(x=>`<tr><td>${fd(x.due)}</td><td>${esc(x.desc)}${x.cli?'<br><small class="mu">'+esc(x.cli)+'</small>':''}</td><td>${esc(x.method)}</td><td class="r">${R(x.gross)}</td><td class="r dg">${x.fee?'−'+R(x.fee):'—'}</td><td class="r"><b>${R(x.net)}</b></td><td>${stTag(x,1)}${x.extra?'<br><small class="wn">+'+R(x.extra)+' encargos</small>':''}${x.paidAt?'<br><small class="mu">'+fd(x.paidAt)+'</small>':''}</td><td>${x.status==='aberto'?`<button class="s" onclick="settle('ar','${x.id}')">Receber</button>${x.saleId?'':` <button class="s" onclick="arForm('${x.id}')">Editar</button>`}`:`<button class="s" onclick="unsettle('ar','${x.id}')">Estornar</button>`}${x.saleId?'':` <button class="s d" onclick="finDel('ar','${x.id}')">✕</button>`}</td></tr>`).join('')||'<tr><td colspan=8 class="mu">Nada por aqui.</td></tr>'}<tr><td colspan=3 class="r"><b>Total</b></td><td class="r"><b>${R(S('gross'))}</b></td><td class="r dg"><b>−${R(S('fee'))}</b></td><td class="r"><b>${R(S('net'))}</b></td><td colspan=2></td></tr></table></div>`}
function finTx0(){const F=db.cfg.fees,row=m=>`<tr><td>${m}</td><td><input type="number" step="0.01" min="0" style="width:90px" value="${F[m].p}" oninput="db.cfg.fees['${m}'].p=+this.value||0;save()"></td><td><input type="number" min="0" style="width:90px" value="${F[m].d}" oninput="db.cfg.fees['${m}'].d=+this.value||0;save()"></td></tr>`;
 return `<div class="card"><h3>Taxas e prazos de recebimento</h3><p class="mu">Defina a taxa cobrada em cada forma de pagamento e em quantos dias o valor cai na conta. As taxas são aplicadas no momento da venda (vendas antigas não mudam) e geram o valor líquido em Contas a receber.</p><div class="tw"><table><tr><th>Forma</th><th>Taxa (%)</th><th>Prazo (dias)</th></tr>${['Dinheiro','Pix','Cartão débito'].map(row).join('')}</table></div></div>
 <div class="card"><h3>Cartão de crédito</h3><div class="f"><div><label>Dias até a 1ª parcela e entre as parcelas</label><input type="number" min="0" value="${F.credD}" oninput="db.cfg.fees.credD=+this.value||0;save()"></div></div><div class="tw" style="margin-top:10px"><table><tr><th>Parcelas</th><th>Taxa total (%)</th><th>Em R$ 100</th></tr>${F.cred.map((p,i)=>`<tr><td>${i+1}x</td><td><input type="number" step="0.01" min="0" style="width:90px" value="${p}" oninput="db.cfg.fees.cred[${i}]=+this.value||0;save();this.parentNode.nextElementSibling.textContent='líquido '+R(100-this.value)"></td><td>líquido ${R(100-p)}</td></tr>`).join('')}</table></div></div>`}
function settle(k,id){const x=db[k].find(z=>z.id===id);if(k==='ar'&&x.method==='Crediário'){crPay([id]);return}modal(`<h3>${k==='ap'?'Registrar pagamento':'Registrar recebimento'}</h3><p class="mu">${esc(k==='ap'?x.party:x.desc)} · vence ${fd(x.due)}</p><div class="f"><div><label>Data</label><input id="s_d" type="date" value="${today()}"></div>${k==='ap'?`<div><label>Valor pago (R$)</label><input id="s_v" type="number" step="0.01" value="${x.v}"></div>`:''}</div><div class="row" style="margin-top:14px"><button class="b" onclick="settleOk('${k}','${id}')">Confirmar</button><button class="s" onclick="close_()">Cancelar</button></div>`)}
function settleOk(k,id){const x=db[k].find(z=>z.id===id),d=$('#s_d').value;if(!d){alert('Informe a data.');return}x.status='pago';x.paidAt=d;if(k==='ap')x.paidV=+$('#s_v').value||x.v;save();close_();render()}
function unsettle(k,id){if(confirm('Estornar e voltar para em aberto?')){const x=db[k].find(z=>z.id===id);x.status='aberto';delete x.paidAt;delete x.paidV;save();render()}}
function finDel(k,id){const x=db[k].find(z=>z.id===id);if(k==='ar'&&x.saleId){alert('Recebíveis de venda não podem ser excluídos. Cancele a venda na aba Vendas.');return}if(confirm('Excluir este lançamento?')){db[k]=db[k].filter(z=>z.id!==id);save();render()}}
function apForm(id){const x=id?db.ap.find(z=>z.id===id):{};modal(`<h3>${id?'Editar':'Nova'} conta a pagar</h3><div class="f"><div class="w"><label>Fornecedor *</label><input id="a1" value="${esc(x.party)}"></div><div class="w"><label>Descrição</label><input id="a2" value="${esc(x.desc)}"></div><div><label>Valor (R$) *</label><input id="a3" type="number" step="0.01" value="${x.v??''}"></div><div><label>Vencimento *</label><input id="a4" type="date" value="${x.due||today()}"></div><div class="w"><label>Linha digitável do boleto (opcional)</label><input id="a5" value="${esc(x.bar)}"></div></div><div class="row" style="margin-top:14px"><button class="b" onclick="apSave('${id||''}')">Salvar</button><button class="s" onclick="close_()">Cancelar</button></div>`)}
function apSave(id){const party=$('#a1').value.trim(),v=+$('#a3').value,due=$('#a4').value;if(!party||!(v>0)||!due){alert('Preencha fornecedor, valor e vencimento.');return}const d={party,desc:$('#a2').value.trim(),v,due,bar:$('#a5').value.trim()};if(id)Object.assign(db.ap.find(z=>z.id===id),d);else db.ap.push({id:uid(),status:'aberto',t:Date.now(),...d});save();close_();render()}
function arForm(id){const x=id?db.ar.find(z=>z.id===id):{};modal(`<h3>${id?'Editar':'Nova'} conta a receber</h3><div class="f"><div class="w"><label>Descrição / cliente *</label><input id="r1" value="${esc(x.desc)}"></div><div><label>Valor (R$) *</label><input id="r2" type="number" step="0.01" value="${x.gross??''}"></div><div><label>Vencimento *</label><input id="r3" type="date" value="${x.due||today()}"></div></div><div class="row" style="margin-top:14px"><button class="b" onclick="arSave('${id||''}')">Salvar</button><button class="s" onclick="close_()">Cancelar</button></div>`)}
function arSave(id){const desc=$('#r1').value.trim(),v=+$('#r2').value,due=$('#r3').value;if(!desc||!(v>0)||!due){alert('Preencha descrição, valor e vencimento.');return}const d={desc,gross:v,fee:0,net:v,due};if(id)Object.assign(db.ar.find(z=>z.id===id),d);else db.ar.push({id:uid(),status:'aberto',t:Date.now(),method:'Outros',cli:'',...d});save();close_();render()}
/* NF-e: revisão antes de lançar */
function nfeReview(){const n=nf,sel=n.items.filter(i=>i.inc&&i.q>0),dp=n.dups.filter(d=>d.inc);
 if(!sel.length){alert('Selecione ao menos um item.');return}
 if(sel.some(i=>!i.pid&&!i.name.trim())){alert('Há produto novo sem nome.');return}
 if(dp.some(d=>!d.venc||!(d.v>0))){alert('Preencha vencimento e valor das parcelas selecionadas.');return}
 const cT=sel.reduce((a,i)=>a+i.q*i.cost,0),pT=dp.reduce((a,d)=>a+d.v,0);
 modal(`<h3>Revisar lançamento · NF-e ${esc(n.num)}</h3><p class="mu">${esc(n.emit)} · CNPJ ${esc(n.cnpj)}</p>
 <b>📦 Entrada no estoque</b><div class="tw"><table><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Estoque</th><th class="r">Custo</th><th>Cadastro</th></tr>${sel.map(it=>{const p=it.pid&&P(it.pid);return `<tr><td>${esc(p?p.name:it.name)}</td><td class="r">+${N(it.q)}</td><td class="r">${p?N(p.stock)+' → '+N(p.stock+it.q):'0 → '+N(it.q)}</td><td class="r">${p?R(p.cost)+' → ':''}${R(it.cost)}</td><td>${p?'Atualiza produto'+(it.updP?' + preço '+R(it.price):''):'<span class="wn">Novo · preço '+R(it.price)+'</span>'}</td></tr>`}).join('')}<tr><td colspan=5 class="r"><b>Custo total das entradas: ${R(cT)}</b></td></tr></table></div>
 <p style="margin-bottom:4px"><b>💳 Contas a pagar</b></p>${dp.length?`<div class="tw"><table><tr><th>Parcela</th><th>Vencimento</th><th class="r">Valor</th></tr>${dp.map(d=>`<tr><td>${esc(d.nDup)}</td><td>${fd(d.venc)}</td><td class="r">${R(d.v)}</td></tr>`).join('')}<tr><td colspan=3 class="r"><b>Total a pagar: ${R(pT)}</b></td></tr></table></div>`:'<p class="mu">Nenhuma conta a pagar será criada.</p>'}
 ${dp.length&&Math.abs(pT-n.total)>0.01?`<p class="wn">Atenção: total das parcelas (${R(pT)}) difere do total da nota (${R(n.total)}).</p>`:''}
 <div class="row" style="margin-top:12px"><button class="b" onclick="nfeConfirm()">Confirmar lançamento</button><button class="s" onclick="close_()">Voltar</button></div>`,1)}
/* CREDIÁRIO */
let psub='venda',rcCli='',rcSel=[],crIds=[];
const hasCarne=s=>(s.pays||[]).some(p=>p.m==='Crediário');
const credUsed=cid=>db.ar.filter(x=>x.cid===cid&&x.method==='Crediário'&&x.status==='aberto').reduce((a,x)=>a+x.gross,0);
const credAvail=cid=>{const c=db.clients.find(x=>x.id===cid);return Math.max(0,(c?+c.limit||0:0)-credUsed(cid))};
const dlate=x=>Math.max(0,Math.round((Date.parse(today())-Date.parse(x.due))/864e5));
function enc(x){const d=x.status==='aberto'?dlate(x):0;if(!d)return{d:0,m:0,j:0,t:x.gross};const L=db.cfg.late,m=+(x.gross*L.mul/100).toFixed(2),j=+(x.gross*L.jur/100*d).toFixed(2);return{d,m,j,t:+(x.gross+m+j).toFixed(2)}}
function pdv(){return `<h2>Ponto de Venda</h2><div class="row" style="margin-bottom:12px"><button class="${psub==='venda'?'b':'s'}" onclick="psub='venda';render()">Venda</button><button class="${psub==='rec'?'b':'s'}" onclick="psub='rec';render()">Receber crediário</button></div>${psub==='venda'?pdvSale():pdvRec()}`}
function pdvRec(){
 const owing=db.clients.filter(c=>db.ar.some(x=>x.cid===c.id&&x.method==='Crediário'&&x.status==='aberto')),c=db.clients.find(x=>x.id===rcCli);
 const ps=c?db.ar.filter(x=>x.cid===c.id&&x.method==='Crediário'&&x.status==='aberto').sort((a,b)=>a.due<b.due?-1:1):[],sel=ps.filter(x=>rcSel.includes(x.id)),st=sel.reduce((a,x)=>a+enc(x).t,0);
 return `<div class="card"><label>Cliente com crediário em aberto</label><select onchange="rcCli=this.value;rcSel=[];render()"><option value="">Selecione…</option>${owing.map(o=>`<option value="${o.id}" ${o.id===rcCli?'selected':''}>${esc(o.name)}</option>`).join('')}</select>${owing.length?'':'<p class="mu">Nenhum cliente com parcelas em aberto.</p>'}</div>
 ${c?`<div class="grid"><div class="card kpi"><small>Limite</small><b>${R(c.limit)}</b></div><div class="card kpi"><small>Em aberto (principal)</small><b>${R(credUsed(c.id))}</b></div><div class="card kpi"><small>Disponível</small><b>${R(credAvail(c.id))}</b></div></div>
 <div class="card tw"><table><tr><th></th><th>Carnê</th><th>Parcela</th><th>Vencimento</th><th class="r">Valor</th><th class="r">Atraso</th><th class="r">Multa</th><th class="r">Juros</th><th class="r">Total</th><th></th></tr>${ps.map(x=>{const e=enc(x);return `<tr><td><input type="checkbox" style="width:auto" ${rcSel.includes(x.id)?'checked':''} onchange="rcTog('${x.id}')"></td><td>#${x.saleN}</td><td>${x.n}/${x.of}</td><td>${fd(x.due)}</td><td class="r">${R(x.gross)}</td><td class="r ${e.d?'dg':''}">${e.d?e.d+' d':'—'}</td><td class="r">${e.m?R(e.m):'—'}</td><td class="r">${e.j?R(e.j):'—'}</td><td class="r"><b>${R(e.t)}</b></td><td><button class="s" onclick="crPay(['${x.id}'])">Receber</button></td></tr>`}).join('')}</table></div>
 <div class="card row"><span>Selecionadas: <b>${sel.length}</b> · Total <b>${R(st)}</b></span><button class="b" ${sel.length?'':'disabled'} onclick="crPay(rcSel)">Receber selecionadas</button>${[...new Set(ps.map(x=>x.saleId))].map(id=>`<button class="s" onclick="dlCarne('${id}')">Carnê #${(db.sales.find(z=>z.id===id)||{}).n}</button>`).join('')}</div>`:''}`}
function rcTog(id){rcSel=rcSel.includes(id)?rcSel.filter(z=>z!==id):[...rcSel,id];render()}
function crPay(ids){crIds=ids;const xs=ids.map(i=>db.ar.find(z=>z.id===i)).filter(x=>x&&x.status==='aberto');if(!xs.length)return;const tot=xs.reduce((a,x)=>a+enc(x).t,0),ex=xs.reduce((a,x)=>a+enc(x).t-x.gross,0);
 modal(`<h3>Receber crediário</h3><table>${xs.map(x=>{const e=enc(x);return `<tr><td>#${x.saleN} · ${x.n||''}/${x.of||''} · venc. ${fd(x.due)}${e.d?` <span class="dg">(${e.d}d de atraso)</span>`:''}</td><td class="r">${R(e.t)}</td></tr>`}).join('')}<tr><td><b>Total a receber</b></td><td class="r"><b>${R(tot)}</b></td></tr></table>${ex?`<p class="wn">Inclui ${R(ex)} de multa e juros.</p><label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--tx)"><input type="checkbox" id="cw" style="width:auto"> Dispensar multa e juros</label>`:''}<div class="f" style="margin-top:10px"><div><label>Forma de recebimento</label><select id="cm"><option>Dinheiro</option><option>Pix</option><option>Cartão débito</option><option>Cartão crédito</option></select></div><div><label>Data</label><input type="date" id="cd" value="${today()}"></div></div><div class="row" style="margin-top:14px"><button class="b" onclick="crOk()">Confirmar recebimento</button><button class="s" onclick="close_()">Cancelar</button></div>`)}
function crOk(){const w=$('#cw')&&$('#cw').checked,m=$('#cm').value,d=$('#cd').value;if(!d){alert('Informe a data.');return}
 crIds.forEach(i=>{const x=db.ar.find(z=>z.id===i);if(!x||x.status!=='aberto')return;const e=enc(x);x.status='pago';x.paidAt=d;x.extra=w?0:+(e.t-x.gross).toFixed(2);x.late=e.d;x.payM=m});
 rcSel=rcSel.filter(i=>!crIds.includes(i));save();close_();render()}
function finTx(){const L=db.cfg.late,C=db.cfg.carne;return finTx0()+`<div class="card"><h3>Crediário: atraso e carnê</h3><div class="f"><div><label>Multa por atraso (%)</label><input type="number" step="0.01" min="0" value="${L.mul}" oninput="db.cfg.late.mul=+this.value||0;save()"></div><div><label>Juros por dia de atraso (%)</label><input type="number" step="0.001" min="0" value="${L.jur}" oninput="db.cfg.late.jur=+this.value||0;save()"></div><div><label>Dias até a 1ª parcela</label><input type="number" min="0" value="${C.d1}" oninput="db.cfg.carne.d1=+this.value||0;save()"></div><div><label>Dias entre as parcelas</label><input type="number" min="1" value="${C.di}" oninput="db.cfg.carne.di=+this.value||1;save()"></div></div><p class="mu">Multa única + juros simples por dia sobre o valor da parcela vencida, calculados na hora do recebimento. Prazos do carnê valem para as próximas vendas.</p></div>`}
/* CARNÊ PDF */
function carnePdf(s,ps,c){const {jsPDF}=window.jspdf,d=new jsPDF({unit:'mm',format:'a4'}),st=db.cfg,L=st.late,tot=ps.reduce((a,x)=>a+x.gross,0),n=ps.length;
 const T=(t,x,y,o)=>d.text(String(t),x,y,o),B=()=>d.setFont('helvetica','bold'),Nm=()=>d.setFont('helvetica','normal'),nm=String(c.name||'').slice(0,60);
 B();d.setFontSize(20);T(st.name||'MINHA LOJA',105,32,{align:'center'});Nm();d.setFontSize(11);T([st.doc?'CNPJ/CPF: '+st.doc:'',st.addr||''].filter(Boolean).join('  |  '),105,39,{align:'center'});
 B();d.setFontSize(26);T('CARNÊ DE CREDIÁRIO',105,66,{align:'center'});
 d.setLineWidth(.4);d.rect(20,78,170,58);d.setFontSize(12);
 [['Cliente',c.name],['CPF/CNPJ',c.doc],['Telefone',c.phone],['Endereço',c.addr],['Venda','nº '+s.n+' - '+dt(s.t)]].forEach(([k,v],i)=>{B();T(k+':',25,88+i*10);Nm();T(String(v||'-').slice(0,68),52,88+i*10)});
 d.rect(20,142,170,34);B();T('Total financiado',25,152);T('Parcelas',85,152);T('1º vencimento',135,152);Nm();d.setFontSize(15);T(R(tot),25,163);T(n+'x de '+R(ps[0].gross),85,163);T(fd(ps[0].due),135,163);
 d.setFontSize(10);B();T('Itens da compra',20,188);Nm();s.items.slice(0,12).forEach((i,k)=>T(i.q+'x '+i.name.slice(0,60)+'  '+R(i.q*i.price),20,194+k*5));
 d.setFontSize(9);T('Após o vencimento incidem multa de '+L.mul+'% e juros de '+L.jur+'% ao dia sobre o valor da parcela.',20,262);
 d.line(40,282,170,282);T('Assinatura do cliente',105,287,{align:'center'});
 ps.forEach((x,i)=>{if(i%4===0)d.addPage();const y=14+(i%4)*70,pc=x.n+'/'+x.of;
  d.setLineWidth(.3);d.rect(12,y,186,62);d.setLineDashPattern([2,2],0);d.line(68,y,68,y+62);d.setLineDashPattern([],0);
  B();d.setFontSize(11);T('Parcela '+pc,16,y+9);Nm();d.setFontSize(10);T('Venc.: '+fd(x.due),16,y+18);T('Valor: '+R(x.gross),16,y+26);T('Venda nº '+s.n,16,y+34);T(nm.slice(0,22),16,y+42);
  B();d.setFontSize(13);T(st.name||'MINHA LOJA',74,y+10);Nm();d.setFontSize(10);T('Cliente: '+nm,74,y+19);T('Parcela '+pc+'    Vencimento: '+fd(x.due),74,y+27);
  B();d.setFontSize(14);T('Valor: '+R(x.gross),74,y+37);Nm();d.setFontSize(8);T('Após o vencimento: multa '+L.mul+'% + juros '+L.jur+'% ao dia.',74,y+45);
  T('Pago em ____/____/______    Recebido por: _______________',74,y+56)});
 return d.output('arraybuffer')}
function carneHtml(s,ps,c){const st=db.cfg,L=st.late;return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Carnê ${s.n}</title><style>body{font:14px Arial;max-width:700px;margin:20px auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:6px}.pg{page-break-after:always}</style></head><body><div class="pg"><h1 style="text-align:center">${esc(st.name||'MINHA LOJA')}</h1><h2 style="text-align:center">CARNÊ DE CREDIÁRIO</h2><p><b>Cliente:</b> ${esc(c.name)}<br><b>CPF/CNPJ:</b> ${esc(c.doc)}<br><b>Telefone:</b> ${esc(c.phone)}<br><b>Endereço:</b> ${esc(c.addr)}<br><b>Venda:</b> #${s.n} · ${dt(s.t)}</p><p><b>Total financiado:</b> ${R(ps.reduce((a,x)=>a+x.gross,0))} em ${ps.length}x</p><ul>${s.items.map(i=>`<li>${i.q}× ${esc(i.name)}</li>`).join('')}</ul><p>Após o vencimento: multa de ${L.mul}% + juros de ${L.jur}% ao dia.</p></div><table><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Pago em</th></tr>${ps.map(x=>`<tr><td>${x.n}/${x.of}</td><td>${fd(x.due)}</td><td>${R(x.gross)}</td><td></td></tr>`).join('')}</table></body></html>`}
async function dlCarne(id){const s=db.sales.find(x=>x.id===id),ps=db.ar.filter(r=>r.saleId===id&&r.method==='Crediário').sort((a,b)=>(a.n||0)-(b.n||0));
 if(!ps.length){alert('Esta venda não tem parcelas de crediário.');return}
 const c=db.clients.find(x=>x.id===s.clientId)||{name:s.clientName};
 if(window.jspdf)await saveFile('carne-venda-'+s.n+'.pdf',carnePdf(s,ps,c),'application/pdf');else await saveFile('carne-venda-'+s.n+'.html',carneHtml(s,ps,c),'text/html')}
/* CANCELAR ENTRADA DE NF-e */
function nfeCancel(id){const z=db.nfes.find(x=>x.id===id);
 if(!z.mv){alert('Esta NF-e foi lançada antes do controle de cancelamento e não pode ser estornada automaticamente. Use uma saída manual em Movimentações.');return}
 const bad=z.mv.filter(m=>{const p=P(m.pid);return !p||p.stock<m.q});
 if(bad.length){alert('Não é possível cancelar: já houve saída de estoque de '+bad.map(m=>(P(m.pid)||{name:'produto excluído'}).name).join(', ')+'.');return}
 const aps=db.ap.filter(a=>a.nfid===id&&a.status!=='cancelado'),pg=aps.filter(a=>a.status==='pago').length;
 if(!confirm('Cancelar a entrada da NF-e '+z.num+'?\n• O estoque dos itens será estornado (os cadastros dos produtos permanecem).\n• '+aps.length+' conta(s) a pagar será(ão) cancelada(s)'+(pg?' (atenção: '+pg+' já paga(s))':'')+'.'))return;
 z.mv.forEach(m=>{const p=P(m.pid);p.stock-=m.q;addMove(p.id,'estorno',-m.q,'Cancelamento NF-e '+z.num)});
 db.conf.filter(c=>c.status==='pendente').forEach(c=>{c.src=c.src.filter(x=>x.nfid!==id)});db.conf=db.conf.filter(c=>c.status!=='pendente'||c.src.length);db.products.forEach(p=>{p.hold=db.conf.some(c=>c.pid===p.id&&c.status==='pendente')});
 aps.forEach(a=>a.status='cancelado');z.canceled=true;save();render()}
/* AUTORIZAÇÃO ADMIN / EXCLUIR VENDA */
let admCb=null;
function askAdmin(msg,cb){admCb=cb;modal(`<h3>🔒 Autorização do administrador</h3><p class="mu">${esc(msg)}</p><label>Senha do administrador (4 dígitos)</label><input id="ad" type="password" inputmode="numeric" maxlength="4" autocomplete="off" onkeydown="if(event.key==='Enter')admOk()"><div class="row" style="margin-top:14px"><button class="b" onclick="admOk()">Autorizar</button><button class="s" onclick="admCb=null;close_()">Cancelar</button></div>`);setTimeout(()=>{const e=$('#ad');e&&e.focus()},50)}
function admOk(){const p=$('#ad').value,u=db.users.find(x=>x.role==='admin'&&x.pin===p);if(!u){alert('Senha incorreta.');$('#ad').value='';return}const cb=admCb;admCb=null;close_();cb&&cb(u.name)}
/* EXCLUIR VENDA (senha admin) */
function delSale(id){const s=db.sales.find(x=>x.id===id);if(!s)return;
 askAdmin('Excluir DEFINITIVAMENTE a venda #'+s.n+'?'+(s.canceled?'':' Os itens voltarão ao estoque.')+' Os recebíveis (inclusive crediário) serão removidos e não há como desfazer. Informe a senha de 4 dígitos do administrador.',()=>{
  if(!s.canceled)s.items.forEach(i=>{const p=P(i.id);if(p){p.stock+=i.q;addMove(p.id,'devolução',i.q,'Exclusão venda #'+s.n)}});
  db.ar=db.ar.filter(r=>r.saleId!==id);db.sales=db.sales.filter(x=>x.id!==id);save();render()})}
/* CONFERÊNCIA DE PREÇOS */
function confAdd(p,it,n,rid,co,po){let e=db.conf.find(c=>c.pid===p.id&&c.status==='pendente');
 if(!e){e={id:uid(),pid:p.id,status:'pendente',t:Date.now(),src:[],costOld:co,priceOld:po,priceFinal:p.price};db.conf.unshift(e)}
 e.src.push({nfid:rid,num:n.num,emit:n.emit,q:it.q});e.costNew=it.cost;e.priceSug=+(it.cost*(1+(db.cfg.markup??50)/100)).toFixed(2);p.hold=true}
function trava(c){const p=P(c.pid);if(!p)return 'Produto excluído';const pr=+c.priceFinal,mm=db.cfg.minMargin??10;
 if(!(pr>0))return 'Informe o preço de venda';if(pr<=p.cost)return 'Preço menor ou igual ao custo';
 if((pr-p.cost)/pr*100<mm)return 'Margem abaixo do mínimo ('+N(mm)+'%)';return ''}
function confSet(id,v){const c=db.conf.find(x=>x.id===id);c.priceFinal=+v||0;save();render()}
function confOk(id){const c=db.conf.find(x=>x.id===id);if(!c||c.status!=='pendente'||trava(c))return;const p=P(c.pid);
 c.prevPrice=p.price;p.price=+c.priceFinal;c.status='confirmado';c.at=Date.now();c.by=me.name;p.hold=db.conf.some(x=>x.pid===p.id&&x.status==='pendente');save();render()}
function confAll(){db.conf.filter(c=>c.status==='pendente'&&!trava(c)).forEach(c=>confOk(c.id))}
function conf(){const mm=db.cfg.minMargin??10,pend=db.conf.filter(c=>c.status==='pendente'),done=db.conf.filter(c=>c.status==='confirmado').sort((a,b)=>b.at-a.at).slice(0,30),ok=pend.filter(c=>!trava(c));
 return `<h2>Conferência de preços</h2><div class="card"><p class="mu" style="margin-top:0">Todo produto que entra por NF-e fica 🔒 travado para venda até você conferir e confirmar o preço aqui. A confirmação só é aceita se não houver trava: preço informado, acima do custo e com margem igual ou maior que a mínima. Ao confirmar, o produto é liberado no PDV.</p><div class="f"><div><label>Margem mínima para liberar (%)</label><input type="number" min="0" value="${mm}" onchange="db.cfg.minMargin=+this.value||0;save();render()"></div></div>${ok.length?`<button class="b" style="margin-top:10px" onclick="confAll()">Confirmar todos os liberados (${ok.length})</button>`:''}</div>
 <div class="card tw"><h3>Aguardando conferência (${pend.length})</h3><table><tr><th>Produto</th><th>NF-e</th><th class="r">Entrada</th><th class="r">Custo</th><th class="r">Preço atual</th><th class="r">Sugerido</th><th>Novo preço</th><th class="r">Margem</th><th>Situação</th><th></th></tr>${pend.map(c=>{const p=P(c.pid)||{name:'(excluído)',cost:0},t=trava(c),pr=+c.priceFinal||0,mg=pr?(pr-p.cost)/pr*100:0,q=c.src.reduce((a,x)=>a+x.q,0),dv=c.costOld?(c.costNew-c.costOld)/c.costOld*100:null;
  return `<tr><td>${esc(p.name)}</td><td>${c.src.map(x=>esc(x.num)).join(', ')}</td><td class="r">+${N(q)}</td><td class="r">${R(c.costNew)}${dv!==null?`<br><small class="${dv>0?'dg':'mu'}">${dv>0?'+':''}${N(dv.toFixed(1))}% (antes ${R(c.costOld)})</small>`:'<br><small class="mu">novo</small>'}</td><td class="r">${c.priceOld==null?'—':R(c.priceOld)}</td><td class="r"><button class="s" onclick="confSet('${c.id}',${c.priceSug})">${R(c.priceSug)}</button></td><td><input type="number" step="0.01" style="min-width:95px" value="${pr}" onchange="confSet('${c.id}',this.value)"></td><td class="r ${t?'dg':''}">${N(mg.toFixed(1))}%</td><td>${t?`<span class="tag dg">🔒 ${esc(t)}</span>`:'<span class="tag">Pronto para liberar</span>'}</td><td><button class="b" ${t?'disabled':''} onclick="confOk('${c.id}')">Confirmar</button></td></tr>`}).join('')||'<tr><td colspan=10 class="mu">Nenhum produto aguardando conferência.</td></tr>'}</table></div>
 <div class="card tw"><h3>Últimas conferências</h3><table><tr><th>Data</th><th>Produto</th><th class="r">Preço anterior</th><th class="r">Preço confirmado</th><th>Por</th></tr>${done.map(c=>`<tr><td>${dt(c.at)}</td><td>${esc((P(c.pid)||{}).name||'(excluído)')}</td><td class="r">${R(c.prevPrice)}</td><td class="r"><b>${R(c.priceFinal)}</b></td><td>${esc(c.by)}</td></tr>`).join('')||'<tr><td colspan=5 class="mu">Nada ainda.</td></tr>'}</table></div>`}
/* PROMOÇÕES */
const pActive=x=>{const t=today();return x.on&&(!x.from||x.from<=t)&&(!x.to||x.to>=t)};
const pMatch=(x,p)=>x.scope==='all'||(x.scope==='cat'&&p.cat&&p.cat===x.cat)||(x.scope==='prod'&&(x.pids||[]).includes(p.id));
const promoOn=p=>db.promos.some(x=>pActive(x)&&pMatch(x,p));
function pCalc(x,p,q){const b=p.price;if(x.type==='percent')return b*q*(1-x.v/100);if(x.type==='preco')return Math.min(b,x.v)*q;const g=Math.floor(q/x.v);return (g*x.m+q%x.v)*b}
function lt(c){const p=P(c.id);let best={t:+(p.price*c.q).toFixed(2),promo:null};db.promos.forEach(x=>{if(pActive(x)&&pMatch(x,p)){const t=+pCalc(x,p,c.q).toFixed(2);if(t<best.t-0.004)best={t,promo:x}}});return best}
const pState=x=>!x.on?'Pausada':x.from&&x.from>today()?'Agendada':x.to&&x.to<today()?'Encerrada':'Ativa';
function promo(){return `<h2>Promoções</h2><div class="card"><button class="b" onclick="promoForm()">+ Nova promoção</button><p class="mu" style="margin-bottom:0">As promoções ativas são aplicadas automaticamente no PDV. Se mais de uma valer para o mesmo produto, vale a que der o menor preço ao cliente.</p></div>
 <div class="card tw"><table><tr><th>Ação</th><th>Regra</th><th>Aplica em</th><th>Período</th><th>Status</th><th></th></tr>${db.promos.map(x=>{const st=pState(x),nm=(x.pids||[]).map(i=>(P(i)||{}).name).filter(Boolean);return `<tr><td><b>${esc(x.name)}</b></td><td>${x.type==='percent'?N(x.v)+'% de desconto':x.type==='preco'?'Por '+R(x.v):'Leve '+x.v+', pague '+x.m}</td><td>${x.scope==='all'?'Todos os produtos':x.scope==='cat'?'Categoria: '+esc(x.cat):esc(nm.slice(0,3).join(', '))+(nm.length>3?' +'+(nm.length-3):'')}</td><td>${x.from||x.to?fd(x.from)+' a '+fd(x.to):'Sem prazo'}</td><td><span class="tag ${st==='Ativa'?'':'wn'}">${st}</span></td><td><button class="s" onclick="promoForm('${x.id}')">Editar</button> <button class="s" onclick="promoTog('${x.id}')">${x.on?'Pausar':'Ativar'}</button> <button class="s d" onclick="promoDel('${x.id}')">✕</button></td></tr>`}).join('')||'<tr><td colspan=6 class="mu">Nenhuma promoção cadastrada.</td></tr>'}</table></div>`}
function promoForm(id){const x=id?db.promos.find(p=>p.id===id):{type:'percent',scope:'prod',pids:[],on:true},cats=[...new Set(db.products.map(p=>p.cat).filter(Boolean))],O=(v,l,c)=>`<option value="${v}" ${c?'selected':''}>${l}</option>`;
 modal(`<h3>${id?'Editar':'Nova'} promoção</h3><div class="f"><div class="w"><label>Nome da ação *</label><input id="pr_n" value="${esc(x.name)}" placeholder="Ex.: Semana do consumidor"></div>
 <div><label>Tipo</label><select id="pr_t" onchange="prT()">${O('percent','% de desconto',x.type==='percent')}${O('preco','Preço promocional',x.type==='preco')}${O('leve','Leve X pague Y',x.type==='leve')}</select></div>
 <div><label id="pr_l1"></label><input id="pr_v" type="number" step="0.01" min="0" value="${x.v??''}"></div><div id="pr_v2"><label>Pague (Y)</label><input id="pr_m" type="number" min="1" value="${x.m||''}"></div>
 <div><label>Aplicar em</label><select id="pr_s" onchange="prT()">${O('prod','Produtos selecionados',x.scope==='prod')}${O('cat','Uma categoria',x.scope==='cat')}${O('all','Todos os produtos',x.scope==='all')}</select></div>
 <div id="pr_c"><label>Categoria</label><select id="pr_cat">${cats.map(c=>O(esc(c),esc(c),c===x.cat)).join('')||'<option value="">(nenhuma categoria cadastrada)</option>'}</select></div>
 <div class="w" id="pr_p"><label>Produtos (Ctrl/Cmd para vários)</label><select id="pr_pids" multiple size="6">${db.products.map(p=>O(p.id,esc(p.name),(x.pids||[]).includes(p.id))).join('')}</select></div>
 <div><label>Início</label><input id="pr_a" type="date" value="${x.from||''}"></div><div><label>Fim</label><input id="pr_b" type="date" value="${x.to||''}"></div></div>
 <div class="row" style="margin-top:14px"><button class="b" onclick="promoSave('${id||''}')">Salvar</button><button class="s" onclick="close_()">Cancelar</button></div>`,1);prT()}
function prT(){const t=$('#pr_t').value,sc=$('#pr_s').value;$('#pr_l1').textContent=t==='percent'?'Desconto (%)':t==='preco'?'Preço promocional (R$)':'Leve (X)';$('#pr_v2').style.display=t==='leve'?'':'none';$('#pr_c').style.display=sc==='cat'?'':'none';$('#pr_p').style.display=sc==='prod'?'':'none'}
function promoSave(id){const name=$('#pr_n').value.trim(),type=$('#pr_t').value,v=+$('#pr_v').value,m=+$('#pr_m').value,scope=$('#pr_s').value,pids=[...$('#pr_pids').selectedOptions].map(o=>o.value),cat=$('#pr_cat').value,from=$('#pr_a').value,to=$('#pr_b').value;
 if(!name){alert('Informe o nome da ação.');return}
 if(type==='percent'&&!(v>0&&v<=100)){alert('Informe um desconto entre 0 e 100%.');return}
 if(type==='preco'&&!(v>=0&&$('#pr_v').value!=='')){alert('Informe o preço promocional.');return}
 if(type==='leve'&&!(Number.isInteger(v)&&Number.isInteger(m)&&m>=1&&v>m)){alert('Informe números inteiros: Leve X maior que Pague Y.');return}
 if(scope==='prod'&&!pids.length){alert('Selecione ao menos um produto.');return}
 if(scope==='cat'&&!cat){alert('Selecione a categoria.');return}
 if(from&&to&&to<from){alert('A data final é anterior à inicial.');return}
 const d={name,type,v,m:type==='leve'?m:0,scope,pids:scope==='prod'?pids:[],cat:scope==='cat'?cat:'',from,to};
 if(id)Object.assign(db.promos.find(p=>p.id===id),d);else db.promos.push({id:uid(),on:true,...d});save();close_();render()}
function promoTog(id){const x=db.promos.find(p=>p.id===id);x.on=!x.on;save();render()}
function promoDel(id){if(confirm('Excluir esta promoção?')){db.promos=db.promos.filter(p=>p.id!==id);save();render()}}
boot();