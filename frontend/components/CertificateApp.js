'use client';

import { useCallback, useEffect, useState } from 'react';

async function request(url, { body, csrf, ...options } = {}) {
  const response = await fetch(url, {
    ...options, cache: 'no-store', credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : { erro: response.status === 429 ? 'Muitas tentativas. Aguarde 15 minutos.' : 'Não foi possível acessar o servidor. Tente novamente.' };
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/auth/login') window.location.assign('/login');
    throw new Error(data.erro || 'Não foi possível concluir a operação.');
  }
  return data;
}

function date(value) { return value?.split('-').reverse().join('/') || '—'; }
function Alert({ children, success = false }) {
  return children ? <p role="alert" className={`alert ${success ? 'success' : 'error'}`}>{children}</p> : null;
}
function Brand() {
  return <a className="brand brand-light" href="/dashboard"><span className="brand-mark">C</span><span><strong>Certifica</strong><small>Centro de Estudo Sena</small></span></a>;
}

function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(event.currentTarget)) });
      window.location.assign(data.redirect);
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return <main className="login-shell"><section className="login-intro"><Brand /><div><p className="eyebrow light">Gestão de certificados</p><h1>Emita, organize e valide com confiança.</h1><p>Uma área segura para administrar os certificados da instituição.</p></div><a className="text-link light" href="/validar">Validar um certificado →</a></section>
    <section className="login-panel"><form className="auth-card" onSubmit={submit}><div><p className="eyebrow">Área administrativa</p><h2>Bem-vindo de volta</h2><p className="muted">Entre com as credenciais da instituição.</p></div><Alert>{error}</Alert><label>Usuário<input name="username" autoComplete="username" maxLength={60} required autoFocus /></label><label>Senha<input name="password" type="password" autoComplete="current-password" required /></label><button className="button primary full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar no sistema'}</button></form></section></main>;
}

function Validation({ code }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!code) return;
    let active = true;
    request(`/api/validar/${encodeURIComponent(code)}`).then(data => { if (active) setResult(data.aluno); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [code]);
  return <main className="public-page"><section className="validation-card"><p className="eyebrow">Validação de autenticidade</p><h1>{result ? 'Certificado válido' : 'Validar certificado'}</h1><Alert>{error}</Alert>
    {code && !result && !error && <p role="status">Consultando certificado…</p>}
    {result && <><div className="status-icon success">✓</div><dl className="details"><div><dt>Aluno</dt><dd>{result.nome_aluno}</dd></div><div><dt>Instituição</dt><dd>{result.escola}</dd></div><div><dt>Período</dt><dd>{date(result.data_inicio)} a {date(result.data_fim)}</dd></div><div><dt>Código</dt><dd className="code">{result.codigo_identificacao}</dd></div></dl></>}
    <form className="validation-form" onSubmit={event => { event.preventDefault(); window.location.assign(`/validar/${encodeURIComponent(new FormData(event.currentTarget).get('codigo').trim())}`); }}><label>Código de autenticidade<input name="codigo" maxLength={80} required defaultValue={code || ''} /></label><button className="button primary">Validar</button></form><p><a className="text-link" href="/login">Área administrativa</a></p></section></main>;
}

const studentFields = [
  ['nome_aluno', 'Nome completo', 'text'], ['escola', 'Instituição', 'text'],
  ['professor', 'Professor', 'text'], ['coordenador', 'Coordenador', 'text'],
  ['data_inicio', 'Data de início', 'date'], ['data_fim', 'Data de término', 'date'],
];

function StudentForm({ session, student, onSaved, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const defaults = student || session.defaults;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request(student ? `/api/alunos/${student.id}` : '/api/alunos', {
        method: student ? 'PUT' : 'POST', csrf: session.csrfToken, body: Object.fromEntries(new FormData(event.currentTarget)),
      });
      onSaved(data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}><div className="form-grid">{studentFields.map(([name, label, type], i) => <label key={name} className={i < 2 ? 'span-2' : ''}>{label}<input name={name} type={type} defaultValue={defaults[name] || ''} maxLength={160} required /></label>)}</div><Alert>{error}</Alert><footer className="form-actions">{onCancel && <button type="button" className="button ghost" onClick={onCancel}>Cancelar</button>}<button className="button primary" disabled={busy || session.user.must_change_password}>{busy ? 'Salvando…' : student ? 'Salvar alterações' : 'Emitir certificado'}</button></footer></form>;
}

function Cadastro({ session }) {
  const [created, setCreated] = useState(null);
  return created ? <section className="content-card form-card"><div className="status-icon success">✓</div><h2>Certificado criado com sucesso</h2><p className="code">{created.codigo_identificacao}</p><div className="button-row"><a className="button primary" href={`/certificado/${created.id}`}>Baixar PDF</a><a className="button secondary" href={`/qr/${created.id}`} target="_blank" rel="noreferrer">Ver QR Code</a><button className="button ghost" onClick={() => setCreated(null)}>Cadastrar outro</button></div></section>
    : <section className="content-card form-card"><StudentForm session={session} onSaved={setCreated} /></section>;
}

function Settings({ session, setSession }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = event.currentTarget;
    try {
      const data = await request('/api/me/password', { method: 'POST', csrf: session.csrfToken, body: Object.fromEntries(new FormData(form)) });
      setMessage(data.mensagem); form.reset();
      setSession({ ...session, user: { ...session.user, must_change_password: false } });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="content-card form-card"><h2>Alterar senha</h2><p className="muted">Use pelo menos 12 caracteres.</p><form onSubmit={submit}><div className="form-grid"><label className="span-2">Senha atual<input type="password" name="senha_atual" autoComplete="current-password" required /></label><label>Nova senha<input type="password" name="nova_senha" autoComplete="new-password" minLength={12} required /></label><label>Confirmar nova senha<input type="password" name="confirmacao" autoComplete="new-password" minLength={12} required /></label></div><Alert>{error}</Alert><Alert success>{message}</Alert><footer className="form-actions"><button className="button primary" disabled={busy}>Alterar senha</button></footer></form></section>;
}

function Dashboard({ session }) {
  const [filters, setFilters] = useState({ busca: '', inicio: '', fim: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setError(''); setBusy(true);
    Promise.all([request(`/api/alunos?${new URLSearchParams({ ...filters, page, limit: 10 })}`), request('/api/stats')])
      .then(([rows, counts]) => { if (active) { setData(rows); setStats(counts); } })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [filters, page, revision]);
  async function remove(student) {
    if (!window.confirm(`Excluir o certificado de ${student.nome_aluno}? Esta ação não pode ser desfeita.`)) return;
    try { await request(`/api/alunos/${student.id}`, { method: 'DELETE', csrf: session.csrfToken }); reload(); }
    catch (err) { setError(err.message); }
  }
  return <><section className="stats-grid" aria-label="Resumo">{[['total', 'Total emitido'], ['ativos', 'Períodos ativos'], ['novos_mes', 'Emitidos neste mês']].map(([key, label]) => <article className="stat-card" key={key}><span className="stat-icon blue">✓</span><div><small>{label}</small><strong>{stats?.[key] ?? '—'}</strong></div></article>)}</section>
    <section className="content-card"><div className="card-heading"><div><h2>Registros emitidos</h2><p className="muted" role="status">{busy ? 'Carregando…' : `${data?.total ?? 0} registros encontrados`}</p></div></div>
      <form className="filters" onSubmit={event => { event.preventDefault(); setPage(1); setFilters(Object.fromEntries(new FormData(event.currentTarget))); }}><label className="search-field"><span className="sr-only">Buscar</span><input name="busca" type="search" placeholder="Buscar por aluno, código ou escola" /></label><label><span className="sr-only">Início do período</span><input name="inicio" type="date" aria-label="Início do período" /></label><label><span className="sr-only">Fim do período</span><input name="fim" type="date" aria-label="Fim do período" /></label><button className="button secondary">Filtrar</button><button className="button ghost" type="reset" onClick={() => { setPage(1); setFilters({ busca: '', inicio: '', fim: '' }); }}>Limpar</button></form>
      <Alert>{error}</Alert><div className="table-wrap"><table><thead><tr><th>Aluno</th><th>Instituição</th><th>Período</th><th>Código</th><th>Ações</th></tr></thead><tbody>{data?.alunos.map(student => <tr key={student.id}><td><strong>{student.nome_aluno}</strong></td><td>{student.escola}</td><td>{date(student.data_inicio)} — {date(student.data_fim)}</td><td><div className="code-mini" title={student.codigo_identificacao}>{student.codigo_identificacao}</div></td><td><div className="actions"><a className="action-link" href={`/certificado/${student.id}`}>PDF</a><a className="action-link" href={`/qr/${student.id}`}>QR</a><a className="action-link" href={`/imprimir/${student.id}`} target="_blank" rel="noreferrer">Imprimir</a><button className="action-link" disabled={session.user.must_change_password} onClick={() => setEditing(student)}>Editar</button><button className="action-link danger" disabled={session.user.must_change_password} onClick={() => remove(student)}>Excluir</button></div></td></tr>)}</tbody></table></div>
      {!busy && data?.total === 0 && <p className="empty-state">Nenhum certificado encontrado com estes filtros.</p>}
      <footer className="pagination-row"><p className="muted">Página {data?.page || 1} de {data?.pages || 1}</p><div className="pagination"><button disabled={busy || !data || data.page <= 1} onClick={() => setPage(data.page - 1)} aria-label="Página anterior">‹</button><button disabled={busy || !data || data.page >= data.pages} onClick={() => setPage(data.page + 1)} aria-label="Próxima página">›</button></div></footer></section>
    {editing && <EditDialog student={editing} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}</>;
}

function EditDialog({ student, session, onClose, onSaved }) {
  const [dialog, setDialog] = useState(null);
  useEffect(() => { if (dialog && !dialog.open) dialog.showModal(); }, [dialog]);
  return <dialog ref={setDialog} className="modal" onCancel={onClose}><div className="modal-card"><header><h2>Editar certificado</h2><button className="icon-button" aria-label="Fechar" onClick={onClose}>×</button></header><StudentForm student={student} session={session} onSaved={onSaved} onCancel={onClose} /></div></dialog>;
}

export default function CertificateApp({ view, code }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (view === 'login' || view === 'validar') return;
    request('/api/me').then(setSession).catch(err => setError(err.message));
  }, [view]);
  if (view === 'login') return <Login />;
  if (view === 'validar') return <Validation code={code} />;
  if (!session) return <main className="public-page"><section className="validation-card"><p role="status">Carregando seu acesso…</p><Alert>{error}</Alert>{error && <button className="button primary" onClick={() => window.location.reload()}>Tentar novamente</button>}</section></main>;
  const titles = { dashboard: 'Certificados', cadastro: 'Novo certificado', configuracoes: 'Configurações' };
  async function logout() {
    try { await request('/api/auth/logout', { method: 'POST', csrf: session.csrfToken }); window.location.assign('/login'); }
    catch (err) { setError(err.message); }
  }
  return <><aside className={`sidebar ${menu ? 'open' : ''}`}><Brand /><nav className="nav-list" aria-label="Navegação principal">{Object.entries(titles).map(([path, label]) => <a key={path} className={view === path ? 'active' : ''} href={`/${path}`}>{label}</a>)}<a href="/validar" target="_blank" rel="noreferrer">Validar certificado</a></nav><div className="sidebar-footer"><div className="user-chip"><span className="avatar">{session.user.nome.charAt(0)}</span><span><strong>{session.user.nome}</strong><small>@{session.user.username}</small></span></div><button className="nav-button" onClick={logout}>Sair</button></div></aside>
    <main className={`app-main ${view !== 'dashboard' ? 'narrow-main' : ''}`}><header className="topbar"><button className="icon-button mobile-only" aria-label="Abrir menu" onClick={() => setMenu(!menu)}>☰</button><div><p className="eyebrow">Gestão CES</p><h1>{titles[view]}</h1></div>{view === 'dashboard' && <a className="button primary" href="/cadastro">＋ Novo certificado</a>}</header><Alert>{error}</Alert>{session.user.must_change_password && <p className="alert warning">Troque a senha inicial para liberar a emissão. <a href="/configuracoes">Trocar agora</a></p>}
      {view === 'dashboard' && <Dashboard session={session} />}{view === 'cadastro' && <Cadastro session={session} />}{view === 'configuracoes' && <Settings session={session} setSession={setSession} />}</main></>;
}
