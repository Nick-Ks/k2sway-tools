import React from 'react';

export function TuningFork(props: any) {
  const { size = 24, strokeWidth = 2, className, ...rest } = props;
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      {...rest}
    >
      <path d="M12 22v-8"/>
      <path d="M10 14a2 2 0 0 1-2-2V2"/>
      <path d="M14 14a2 2 0 0 0 2-2V2"/>
    </svg>
  );
}
