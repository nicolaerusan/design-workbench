import React, { useState } from 'react';

export function Button({ label = 'Click to try' }: { label?: string }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)} style={{ cursor: 'pointer', padding: '12px 20px', fontFamily: 'system-ui', fontSize: 14, fontWeight: 500, background: '#242523', color: '#fff', border: '1px solid #242523', borderRadius: 6, boxShadow: '3px 3px 0 #c1c5b7', letterSpacing: '0.02em' }}>
    {label} · {count}
  </button>;
}
