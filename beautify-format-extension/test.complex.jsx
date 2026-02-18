import React, { useState } from 'react';

const ComplexComponent = ({ items, onSelect }) => {
  const [selected, setSelected] = useState(null);

  const handleClick = (id) => {
    setSelected(id);
    onSelect(id);
  };

  return (
    <div className="complex-container" style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <h1>Complex JSX Example</h1>
      {items.length > 0 ? (
        <ul className="item-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`item ${selected === item.id ? 'selected' : ''}`}
              onClick={() => handleClick(item.id)}
              role="button"
              tabIndex={0}
            >
              <span className="item-name">{item.name}</span>
              {item.details && (
                <div className="item-details">
                  <p>{item.details.description}</p>
                  <small>Created at: {new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <p>No items found.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} My Company</p>
      </footer>
    </div>
  );
};

export default ComplexComponent;
