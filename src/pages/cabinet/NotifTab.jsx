import { useState, useEffect } from 'react'
import { subscribeNotifications, clearNotification, clearAllNotifications } from '../../firebase/db'
import './NotifTab.css'

function fmtTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  if (isToday) return time;
  if (isYesterday) return `вчора ${time}`;
  return `${p(d.getDate())}.${p(d.getMonth()+1)} ${time}`;
}

// Гліфи для іконок «метал + глянець» (замість емодзі)
const GL = {
  check:  <polyline points="5 12 10 17 19 8"/>,
  cross:  <><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>,
  warn:   <><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></>,
  swap:   <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  star:   <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>,
  car:    <><path d="M5 17h14M3 17V9l3-5h12l3 5v8M3 9h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
  speak:  <><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/></>,
  cal:    <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  bell:   <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
  medal:  <><circle cx="12" cy="15" r="6"/><path d="M8.5 10L6 2h4l2 5 2-5h4l-2.5 8"/></>,
}
const ACC_COLOR = { green:'#2f9e44', red:'#d92d2d', gold:'#b7860b', blue:'#2563eb', dim:'#64748b' }

const TYPE_META = {
  booking_confirmed:   { icon: GL.check, label: 'Підтверджено', accent: 'green' },
  booking_cancelled:   { icon: GL.cross, label: 'Скасовано',    accent: 'red'   },
  booking_noshow:      { icon: GL.warn, label: 'Пропущено',    accent: 'red'   },
  booking_rescheduled: { icon: GL.swap, label: 'Перенесено',   accent: 'gold'  },
  queue_offer:         { icon: GL.star, label: 'Черга',        accent: 'blue'  },
  slot_freed:          { icon: GL.car, label: 'Слот вільний', accent: 'blue'  },
  admin_message:       { icon: GL.speak, label: 'Від майстра', accent: 'blue' },
  lesson_reminder_day: { icon: GL.cal, label: 'Завтра запис', accent: 'gold'  },
  reminder:            { icon: GL.bell, label: 'Нагадування', accent: 'gold'  },
  badge:               { icon: GL.medal, label: 'Заохочення',      accent: 'gold'  },
  system:              { icon: GL.bell, label: 'Системне',     accent: 'dim'   },
}

export default function NotifTab({ user, onSeen }) {
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeNotifications(user.uid, items => {
      setNotifications(items)
    })
  }, [user?.uid])

  useEffect(() => {
    if (notifications.length > 0) onSeen?.()
  }, [notifications])

  return (
    <div className="notif-tab fade-up">
      {notifications.length === 0 && (
        <div className="notif-empty">
          <div className="notif-empty-icon">🔔</div>
          <div className="notif-empty-title">Немає сповіщень</div>
          <div className="notif-empty-sub">Тут з'являться сповіщення про записи</div>
        </div>
      )}
      {notifications.length > 0 && (
        <div className="notif-toolbar">
          <button className="notif-clear-all" onClick={() => clearAllNotifications(user.uid)}>
            Очистити всі
          </button>
        </div>
      )}
      <div className="notif-list">
        {notifications.map(n => {
          const meta = TYPE_META[n.type] || TYPE_META.system
          return (
            <div key={n.id} className={`notif-card notif-accent-${meta.accent}`}>
              <div className="notif-left">
                <div className="metal3d notif-metal" style={{ '--ic': ACC_COLOR[meta.accent] || ACC_COLOR.dim }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
                </div>
              </div>
              <div className="notif-body">
                <div className="notif-header">
                  <span className="notif-title">{n.title}</span>
                </div>
                {n.body && <div className="notif-text">{n.body}</div>}
                <div className="notif-time">{n.date ? `${n.date} · ${n.time}` : fmtTs(n.ts)}</div>
              </div>
              <button className="notif-dismiss" onClick={() => clearNotification(user.uid, n.id)} aria-label="Видалити">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
