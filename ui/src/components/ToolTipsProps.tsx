import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '5px',
    padding: '5px 10px',
    backgroundColor: '#333',
    color: 'white',
    borderRadius: '4px',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    visibility: isVisible ? 'visible' : 'hidden',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.3s',
  };

  return (
    <div 
      style={containerStyle}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <div style={tooltipStyle}>
        {text}
      </div>
    </div>
  );
};

export {Tooltip};