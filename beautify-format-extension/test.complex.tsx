import React, { useState, useEffect } from 'react';
import { Component } from 'react';
import axios from 'axios';

interface Props {
  title: string;
  isActive?: boolean;
}

const MyComponent: React.FC<Props> = ({ title, isActive }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get('/api/data').then((response) => {
      setData(response.data);
    });
  }, []);

  return (
    <div className='container' style={{ padding: '10px' }}>
      <h1 data-testid='title'>{title}</h1>
      {isActive && (
        <span className="active-badge"
              onClick={() => console.log('Clicked')}
        >
          Active
        </span>
      )}
      <ul>
        {data && data.map((item: any) => (
          <li key={item.id}>
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyComponent;
