import { useState, useEffect } from "react";
import { updateUserProfile, getAdminSettings, getCurrentSlug } from "../../firebase/db";
import { useTheme, PALETTES } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { getInitials, formatPhone } from "../../utils/format";
import { APP_VERSION } from "../../version.js";
import { auth } from "../../firebase/config";
import { getCurrentIid } from "../../firebase/db";
import { signOut } from "../../firebase/auth";
import "./ProfileTab.css";

export default function ProfileTab({ user, profile, onProfileUpdate, badges = [] }) {
  const { palette, setPalette } = useTheme();
  const { showToast, ToastEl } = useToast();

  const [instructorProfile, setInstructorProfile] = useState(null);
  useEffect(() => {
    getAdminSettings().then(s => setInstructorProfile(s.profile || null)).catch(() => {});
  }, []);
  const iPhone = instructorProfile?.phone || '';
  const iAddress = instructorProfile?.address || '';
  const iPhoneDigits = iPhone.replace(/\D/g, '');

  // Видалення власного акаунта (дані записів, чатів, сповіщень + обліковий запис). Незворотно.
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const resp = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "student", iid: getCurrentIid(), uid: user.uid }),
      });
      if (!resp.ok) throw new Error("server");
      try { localStorage.clear(); } catch { /* ignore */ }
      await signOut().catch(() => {});
      window.location.href = "/";
    } catch {
      setDeleting(false);
      showToast("Не вдалося видалити акаунт. Спробуйте пізніше");
    }
  };

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const startEdit = () => {
    setForm({
      name: profile.name || "",
      studentType: profile.studentType || "school",
      experience: profile.experience || "no_license",
      filmingConsent: profile.filmingConsent ?? true,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("Введи імʼя");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        name: form.name.trim(),
        studentType: form.studentType,
        experience: form.experience,
        filmingConsent: form.filmingConsent,
      });
      await onProfileUpdate?.();
      setEditing(false);
      setForm(null);
    } catch (e) {
      showToast("Помилка: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const forceUpdate = async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  };

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--dim)" }}>
        Завантаження профілю...
      </div>
    );
  }

  return (
    <div className="profile-tab">
      <div className="profile-banner">
        <div className="profile-avatar">{getInitials(profile.name)}</div>
        <div className="profile-name">{profile.name}</div>
        <div className="profile-phone">{formatPhone(profile.phone || user?.phoneNumber)}</div>
      </div>

      {(profile?.discount || 0) > 0 && (
        <div style={{textAlign:'center',padding:'0 16px 12px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 14px',borderRadius:10,background:'rgba(246,178,27,0.1)',border:'1px solid rgba(246,178,27,0.25)',fontSize:13,fontWeight:700,color:'#f6b21b'}}>
            🏷️ Ваша знижка: {profile.discount}₴/год
          </div>
        </div>
      )}
      <div className="profile-section">
        <div className="section-head">
          <div className="section-title">Анкета</div>
          {!editing && (
            <button className="edit-btn" onClick={startEdit}>✏️ Редагувати</button>
          )}
        </div>

        {!editing ? (
          <>
            <div className="profile-row">
              <span className="key">Імʼя</span>
              <span className="val">{profile.name || "—"}</span>
            </div>
            <div className="profile-row">
              <span className="key">Зйомка відео/аудіо для реклами</span>
              <span className="val">{profile.filmingConsent ? "Так" : "Ні"}</span>
            </div>
          </>
        ) : (
          <div className="profile-edit">
            <label className="edit-label">Імʼя та прізвище</label>
            <input
              className="edit-input"
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />

            <div className="edit-toggle-row">
              <span className="key">Зйомка відео/аудіо для реклами</span>
              <button
                className={`edit-switch${form.filmingConsent ? " on" : ""}`}
                onClick={() => setForm(f => ({ ...f, filmingConsent: !f.filmingConsent }))}
              >
                <span className="edit-switch-knob" />
              </button>
            </div>

            <div className="edit-actions">
              <button className="edit-cancel" onClick={cancelEdit} disabled={saving}>Скасувати</button>
              <button className="edit-save" onClick={handleSave} disabled={saving}>
                {saving ? "Збереження…" : "Зберегти"}
              </button>
            </div>
          </div>
        )}
      </div>


      {instructorProfile?.name && (
        <div className="profile-section">
          <div className="section-title">🚗 Мій майстер</div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {instructorProfile.photo
              ? <img src={instructorProfile.photo} alt="" style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
              : <div className="profile-avatar" style={{width:52,height:52,fontSize:18,margin:0,flexShrink:0}}>{getInitials(instructorProfile.name)}</div>}
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:800,color:'var(--text)',wordBreak:'break-word'}}>{instructorProfile.name}</div>
              {Number(instructorProfile.experience) > 0 && (
                <div style={{fontSize:11,color:'var(--dim)',marginTop:2}}>Досвід: {instructorProfile.experience} р.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {iPhone && (
        <div className="profile-section">
          <div className="section-title">Контакти майстра</div>
          <div className="contact-phone-block">
            <div className="contact-btns">
              <a href={`tel:${iPhone}`} className="contact-btn contact-btn--call" aria-label="Зателефонувати">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.01l-2.21 2.21z"/></svg>
              </a>
              <a href={`https://t.me/+${iPhoneDigits}`} target="_blank" rel="noopener noreferrer" className="contact-btn contact-btn--tg" aria-label="Telegram">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8c-.12.57-.46.71-.93.44l-2.58-1.9-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.62 4.72-4.26c.2-.18-.05-.28-.32-.1L7.6 14.47l-2.54-.79c-.55-.17-.56-.55.12-.82l9.93-3.83c.46-.17.86.11.53.77z"/></svg>
              </a>
              <a href={`viber://chat?number=%2B${iPhoneDigits}`} className="contact-btn contact-btn--viber" aria-label="Viber">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 1.5C7.5 1.7 4 4.4 3.2 8.2c-.4 2-.3 3.9.4 5.7.5 1.3 1.4 2.5 2.4 3.5l.3 3.3c.1.6.8.8 1.2.4l2.4-2.1c.6.1 1.2.2 1.8.2 4.3 0 7.9-3.2 8.3-7.4.5-4.8-3-9.6-8.6-10.3zm4.5 13.2c-.4.4-1 .7-1.6.8-.3.1-.7.1-1 0-.9-.2-1.7-.6-2.5-1.1-1.5-1-2.8-2.3-3.6-3.9-.4-.8-.7-1.6-.7-2.5 0-.6.2-1.2.6-1.6.3-.4.8-.6 1.3-.6.2 0 .4 0 .5.1.2.1.3.2.4.4l1.3 1.8c.1.2.2.4.2.6 0 .2-.1.4-.3.6l-.4.4c-.1.1-.2.2-.2.3s0 .2.1.3c.4.7 1 1.3 1.6 1.8.3.2.5.2.7 0l.4-.4c.2-.2.4-.3.6-.3.2 0 .4.1.6.2l1.8 1.2c.2.1.3.3.4.5.1.4-.1.8-.2 1.4z"/></svg>
              </a>
              <a href={`https://wa.me/${iPhoneDigits}`} target="_blank" rel="noopener noreferrer" className="contact-btn contact-btn--wa" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.72.9-.88 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.54-.45-.47-.62-.47-.16 0-.35-.02-.53-.02s-.48.07-.73.34c-.25.28-.96.94-.96 2.3 0 1.35.98 2.66 1.12 2.84.14.18 1.93 2.94 4.67 4.13.65.28 1.16.45 1.56.57.65.21 1.25.18 1.72.11.52-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z"/><path d="M12.04 2C6.48 2 2 6.48 2 12.04c0 1.85.5 3.58 1.37 5.06L2 22l5.08-1.33A10.02 10.02 0 0012.04 22C17.6 22 22 17.52 22 12.04 22 6.48 17.6 2 12.04 2zm0 18.16c-1.7 0-3.28-.46-4.64-1.26l-.33-.2-3.42.9.91-3.34-.22-.34a8.15 8.15 0 01-1.28-4.38c0-4.5 3.66-8.16 8.16-8.16 4.5 0 8.16 3.66 8.16 8.16 0 4.5-3.66 8.16-8.16 8.16z"/></svg>
              </a>
            </div>
          </div>
          {iAddress && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(iAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              <div className="ico">📍</div>
              <div className="info">
                <div className="lbl">Адреса</div>
                <div className="val">{iAddress}</div>
              </div>
            </a>
          )}
        </div>
      )}

      <div className="profile-section">
        <div className="section-title">🏅 Мої заохочення{badges.length > 0 ? ` (${badges.length})` : ''}</div>
        {badges.length === 0 ? (
          <div style={{fontSize:12,color:'var(--dim)',textAlign:'center',padding:'6px 0',lineHeight:1.5}}>
            Поки немає заохочень. Майстер видає їх за записи.
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(96px,1fr))',gap:8}}>
            {badges.map(x => (
              <div key={x.id} style={{textAlign:'center',padding:'10px 6px',borderRadius:12,
                background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)'}}>
                <div style={{fontSize:30,lineHeight:1.1}}>{x.icon}</div>
                <div style={{fontSize:11,fontWeight:800,color:'var(--text)',marginTop:4,lineHeight:1.25,wordBreak:'break-word'}}>{x.label}</div>
                {x.awardedAt && <div style={{fontSize:9,color:'var(--dim)',marginTop:3}}>{new Date(x.awardedAt).toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit' })}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-section">
        <div className="section-title">🎨 Оформлення</div>
        <div className="edit-tiles">
          {PALETTES.map(p => (
            <button key={p.id} type="button" className={`edit-tile${palette === p.id ? " selected" : ""}`} onClick={() => setPalette(p.id)}>
              <span style={{display:"flex",justifyContent:"center",gap:4,marginBottom:6}}>
                {p.colors.map(c => <i key={c} style={{width:14,height:14,borderRadius:"50%",background:c,display:"block",boxShadow:"0 0 0 1.5px rgba(255,255,255,0.35)"}}/>)}
              </span>
              {p.name}
            </button>
          ))}
        </div>
        <div style={{fontSize:12,color:"var(--faint)",marginTop:8,lineHeight:1.5}}>
          Темний або світлий режим перемикає кнопка в шапці.
        </div>
      </div>

      <div className="profile-section">
        <div className="section-title">🎁 Запросити друга</div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:10,lineHeight:1.5}}>
          Поділіться посиланням — коли друг запишеться на перший запис, ви отримаєте бонусний запис!
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button
            onClick={() => {
              const slug = getCurrentSlug();
              const origin = window.location.origin;
              const link = slug ? `${origin}/i/${slug}/?ref=${user.uid}` : `${origin}/?ref=${user.uid}`;
              navigator.clipboard.writeText(link)
                .then(() => showToast("Посилання скопійовано!"))
                .catch(() => showToast("Скопіюйте: " + link));
            }}
            className="edit-save"
            style={{flex:1}}
          >
            📋 Копіювати
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              onClick={() => {
                const slug = getCurrentSlug();
                const origin = window.location.origin;
                const link = slug ? `${origin}/i/${slug}/?ref=${user.uid}` : `${origin}/?ref=${user.uid}`;
                navigator.share({ title: 'Juno', text: 'Запишись онлайн!', url: link }).catch(() => {});
              }}
              className="edit-save"
              style={{flex:1,background:'rgba(99,155,255,0.18)',color:'#6b9bff'}}
            >
              📤 Поділитись
            </button>
          )}
        </div>
        {(profile.referralBonusLessons || 0) > 0 && (
          <div style={{textAlign:"center",fontSize:13,color:"#fbbf24",fontWeight:700,padding:"6px 0"}}>
            🎁 Ваш бонус: {profile.referralBonusLessons} бонусний запис{profile.referralBonusLessons > 1 ? "и" : ""}
          </div>
        )}
        {(profile.lessonBalance || 0) > 0 && (
          <div style={{textAlign:"center",fontSize:13,color:"#34d399",fontWeight:700,padding:"6px 0"}}>
            🎓 Залишок записів: {profile.lessonBalance}
          </div>
        )}
      </div>

      <div style={{margin:"18px 4px 0",textAlign:"center"}}>
        {!delOpen ? (
          <button onClick={() => setDelOpen(true)} style={{background:"none",border:"none",color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit"}}>
            Видалити акаунт
          </button>
        ) : (
          <div style={{padding:"14px",borderRadius:14,border:"1px solid rgba(239,68,68,0.4)",background:"rgba(239,68,68,0.08)",textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#f87171",marginBottom:6}}>Видалити акаунт назавжди?</div>
            <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.5,marginBottom:10}}>
              Будуть видалені ваш профіль, записи, чат і сповіщення, а майбутні записи скасовані. Це неможливо скасувати.
              Щоб підтвердити, введіть слово <b style={{color:"var(--text)"}}>ВИДАЛИТИ</b>.
            </div>
            <input value={delText} onChange={e => setDelText(e.target.value)} placeholder="ВИДАЛИТИ"
              style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.18)",background:"rgba(0,0,0,0.3)",color:"var(--text)",fontSize:14,outline:"none",marginBottom:10,fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleDeleteAccount} disabled={deleting || delText.trim().toUpperCase() !== "ВИДАЛИТИ"}
                style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:(deleting||delText.trim().toUpperCase()!=="ВИДАЛИТИ")?"default":"pointer",background:(deleting||delText.trim().toUpperCase()!=="ВИДАЛИТИ")?"rgba(239,68,68,0.25)":"#ef4444",color:"#fff",fontWeight:800,fontSize:13,fontFamily:"inherit"}}>
                {deleting ? "Видалення…" : "Видалити"}
              </button>
              <button onClick={() => { setDelOpen(false); setDelText(""); }} disabled={deleting}
                style={{padding:"10px 16px",borderRadius:10,border:"1px solid rgba(255,255,255,0.18)",background:"transparent",color:"var(--text)",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Скасувати</button>
            </div>
          </div>
        )}
      </div>

      <div onClick={forceUpdate} style={{textAlign:"center",padding:"12px 0 4px",color:"#5a5c62",fontSize:13,fontWeight:600,letterSpacing:0.5,cursor:"pointer"}}>
        {APP_VERSION}
      </div>

      {ToastEl}
    </div>
  );
}
