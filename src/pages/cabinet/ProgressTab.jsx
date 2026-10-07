import { useMemo } from "react";
import "./ProgressTab.css";

const getWeekStart = dateStr => {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
};

export default function ProgressTab({ user, profile, bookingsData }) {
  const { bookings, schoolHours } = bookingsData || { bookings: [], schoolHours: 0 };

  const completed = useMemo(
    () => bookings.filter(b => b.status === "confirmed" && new Date(b.date) < new Date()),
    [bookings]
  );

  const totalLessons = completed.length;
  const schoolLessons = completed.filter(b => b.serviceType === "school").length;
  const privateLessons = completed.filter(b => b.serviceType === "private").length;
  const noShowCount = useMemo(() => bookings.filter(b => b.status === 'noshow').length, [bookings]);
  const attendanceRate = totalLessons + noShowCount > 2
    ? Math.round(totalLessons / (totalLessons + noShowCount) * 100)
    : null;
  const totalSpent = useMemo(() => completed.filter(b => b.isPaid && b.price > 0).reduce((s, b) => s + (b.price || 0), 0), [completed]);
  const totalDebt = useMemo(() => completed.filter(b => !b.isPaid && b.price > 0).reduce((s, b) => s + (b.price || 0), 0), [completed]);

  const lessonStreak = useMemo(() => {
    if (!completed.length) return 0;
    const weeksWithLessons = new Set(completed.map(b => getWeekStart(b.date)));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7;
    const thisWeekMs = today.getTime() - dow * 86400000;
    const thisWeek = new Date(thisWeekMs).toISOString().slice(0, 10);
    let streak = 0;
    const startIdx = weeksWithLessons.has(thisWeek) ? 0 : 1;
    for (let i = startIdx; i < 52; i++) {
      const key = new Date(thisWeekMs - i * 7 * 86400000).toISOString().slice(0, 10);
      if (weeksWithLessons.has(key)) streak++;
      else break;
    }
    return streak;
  }, [completed]);

  return (
    <div className="progress-tab">
      {(() => {
        const today = new Date().toISOString().slice(0,10);
        const next = bookings
          .filter(b => b.status === 'confirmed' && b.date >= today)
          .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))[0];
        if (!next) return null;
        const [,mm,dd] = next.date.split('-');
        const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1);
        const isToday = next.date === today;
        const isTomorrow = next.date === tomorrowDate.toISOString().slice(0,10);
        const dayLabel = isToday ? 'Сьогодні' : isTomorrow ? 'Завтра' : `${parseInt(dd)}.${parseInt(mm)}`;
        return (
          <div className="progress-hero" style={{
            marginBottom:14,
            background:'linear-gradient(135deg,rgba(99,155,255,0.14),rgba(99,155,255,0.06))',
            border:'1px solid rgba(99,155,255,0.3)',
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:28,lineHeight:1}}>📅</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'#6b9bff',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Наступний запис</div>
                <div style={{fontSize:18,fontWeight:900,color:'var(--text)'}}>{dayLabel}{next.time ? ` · ${next.time}` : ''}</div>
                {next.serviceName && <div style={{fontSize:12,color:'var(--dim)',marginTop:2}}>{next.serviceName}</div>}
              </div>
            </div>
          </div>
        );
      })()}
      {(profile?.lessonBalance || 0) > 0 && (
        <div className="progress-hero" style={{
          marginBottom:14,
          background:'linear-gradient(135deg,rgba(74,222,128,0.14),rgba(74,222,128,0.06))',
          border:'1px solid rgba(74,222,128,0.3)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:28,lineHeight:1}}>🎓</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'#4ade80',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Залишок записів</div>
              <div style={{fontSize:18,fontWeight:900,color:'var(--text)'}}>
                {profile.lessonBalance} {profile.lessonBalance === 1 ? 'запис' : profile.lessonBalance < 5 ? 'записи' : 'записів'}
              </div>
              <div style={{fontSize:12,color:'var(--dim)',marginTop:2}}>Передоплачених записів</div>
            </div>
          </div>
        </div>
      )}
      {completed.length > 0 && (() => {
        const last = [...completed].sort((a,b_) => b_.date.localeCompare(a.date) || (b_.time||'').localeCompare(a.time||''))[0];
        const [,mm,dd] = last.date.split('-');
        return (
          <div className="progress-hero" style={{
            marginBottom:14,
            background:'linear-gradient(135deg,rgba(168,85,247,0.10),rgba(168,85,247,0.04))',
            border:'1px solid rgba(168,85,247,0.22)',
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:28,lineHeight:1}}>🏁</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:'rgba(192,132,252,0.9)',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Останній запис</div>
                <div style={{fontSize:18,fontWeight:900,color:'var(--text)'}}>{parseInt(dd)}.{parseInt(mm)}{last.time ? ` · ${last.time}` : ''}</div>
                {last.serviceName && <div style={{fontSize:12,color:'var(--dim)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{last.serviceName}</div>}
              </div>
              {last.rating > 0 && (
                <div style={{flexShrink:0}}>
                  <span style={{fontSize:14,color:'#fbbf24'}}>{'★'.repeat(last.rating)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      <div className="progress-hero" style={{ marginTop: 14 }}>
        <div className="progress-title" style={{ marginBottom: 14 }}>Статистика записів</div>
        <div className="stat-row">
          <div className="stat-btn">
            <div className="num">{totalLessons}</div>
            <div className="lbl">всього</div>
          </div>
          <div className="stat-btn">
            <div className="num">{schoolHours}</div>
            <div className="lbl">стандарт</div>
          </div>
          <div className="stat-btn">
            <div className="num">{privateLessons}</div>
            <div className="lbl">індивідуальні</div>
          </div>
          {attendanceRate !== null && (
            <div className="stat-btn">
              <div className="num" style={{color: attendanceRate >= 90 ? '#63d37b' : attendanceRate >= 70 ? '#f6b21b' : '#f87171'}}>{attendanceRate}%</div>
              <div className="lbl">явка</div>
            </div>
          )}
        </div>
      </div>

      {(totalSpent > 0 || totalDebt > 0) && (
        <div className="progress-hero" style={{ marginTop: 14 }}>
          <div className="progress-title" style={{ marginBottom: 10 }}>💰 Фінанси</div>
          <div className="stat-row">
            {totalSpent > 0 && (
              <div className="stat-btn">
                <div className="num" style={{ color:'#63d37b', fontSize:14 }}>{totalSpent.toLocaleString()} ₴</div>
                <div className="lbl">оплачено</div>
              </div>
            )}
            {totalDebt > 0 && (
              <div className="stat-btn">
                <div className="num" style={{ color:'#f87171', fontSize:14 }}>{totalDebt.toLocaleString()} ₴</div>
                <div className="lbl">борг</div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
