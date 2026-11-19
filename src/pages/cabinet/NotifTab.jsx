import { useState, useEffect } from 'react'
import { MetalIcon } from '../../MetalIcon'
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

const ACC_COLOR = { green:'#2f9e44', red:'#d92d2d', gold:'#b7860b', blue:'#2563eb', dim:'#64748b' }

const TYPE_META = {
  booking_confirmed:   { icon: 'check', label: 'Підтверджено', accent: 'green' },
  booking_cancelled:   { icon: 'cross', label: 'Скасовано',    accent: 'red'   },
  booking_noshow:      { icon: 'warn', label: 'Пропущено',    accent: 'red'   },
  booking_rescheduled: { icon: 'swap', label: 'Перенесено',   accent: 'gold'  },
  queue_offer:         { icon: 'star', label: 'Черга',        accent: 'blue'  },
  slot_freed:          { icon: 'car', label: 'Слот вільний', accent: 'blue'  },
  admin_message:       { icon: 'speak', label: 'Від майстра', accent: 'blue' },
  lesson_reminder_day: { icon: 'calendar', label: 'Завтра запис', accent: 'gold'  },
  reminder:            { icon: 'bell', label: 'Нагадування', accent: 'gold'  },
  badge:               { icon: 'medal', label: 'Заохочення',      accent: 'gold'  },
  system:              { icon: 'bell', label: 'Системне',     accent: 'dim'   },
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
          <div className="notif-empty-icon"><MetalIcon name="bell" size={56}/></div>
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
                <MetalIcon name={meta.icon} size={38} square color={ACC_COLOR[meta.accent] || ACC_COLOR.dim}/>
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
