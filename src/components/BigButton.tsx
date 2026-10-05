import React from 'react';

interface BigButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  size?: 'normal' | 'large';
}

export const BigButton: React.FC<BigButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  className = '',
  size = 'normal',
}) => {
  const baseClasses =
    'w-full min-h-[48px] rounded-2xl font-bold flex items-center justify-center text-center transition-all duration-150 active:scale-[0.98] select-none focus-visible:outline-saffron';
  
  const sizeClasses = size === 'large' ? 'py-4 px-6 text-2xl' : 'py-3 px-5 text-lg';

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses = disabled
        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
        : 'bg-saffron text-navy hover:bg-[#e09430] active:bg-[#d08527] shadow-neu-btn';
      break;
    case 'secondary':
      variantClasses = disabled
        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
        : 'bg-navy text-white hover:bg-[#1e2f56] active:bg-[#101b33] shadow-sm';
      break;
    case 'danger':
      variantClasses = disabled
        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
        : 'bg-rukoRed text-white hover:bg-[#cc4c26] active:bg-[#b54220] shadow-sm';
      break;
    case 'outline':
      variantClasses = disabled
        ? 'border-2 border-slate-200 text-slate-400 cursor-not-allowed'
        : 'border-2 border-slate-300 text-navy hover:bg-slate-100 active:bg-slate-200';
      break;
    case 'ghost':
      variantClasses = disabled
        ? 'text-slate-300 cursor-not-allowed'
        : 'text-slate-600 hover:text-navy hover:bg-slate-100';
      break;
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
};
