import React, { useState } from 'react';

export function Button({ label = 'Click to try' }: { label?: string }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)} style={{ margin: 32, padding: '12px 18px', fontFamily: 'system-ui', borderRadius: 8 }}>
    {label} · {count}
  </button>;
}
