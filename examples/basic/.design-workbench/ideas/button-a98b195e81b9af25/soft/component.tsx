import React, { useState } from 'react';

export function Button({ label = 'Click to try' }: { label?: string }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)} style={{ cursor: 'pointer', padding: '12px 20px', fontFamily: 'system-ui', fontSize: 14, fontWeight: 500, background: '#eaf0e8', color: '#284432', border: '1px solid #d1dfcf', borderRadius: 999, boxShadow: '0 2px 3px #28443208' }}>
    {label} · {count}
  </button>;
}
