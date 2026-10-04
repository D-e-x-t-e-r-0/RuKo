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
        ? 'bg-saffron/40 text-navy/60 cursor-not-allowed'
        : 'bg-saffron text-navy hover:bg-[#e09430] active:bg-[#d08527] shadow-diya';
      break;
    case 'secondary':
      variantClasses = disabled
        ? 'bg-rukoGreen/40 text-cream/50 cursor-not-allowed'
        : 'bg-rukoGreen text-cream hover:bg-[#259b8d] active:bg-[#1f8478] shadow-md';
      break;
    case 'danger':
      variantClasses = disabled
        ? 'bg-rukoRed/40 text-cream/50 cursor-not-allowed'
        : 'bg-rukoRed text-cream hover:bg-[#cc4c26] active:bg-[#b54220] shadow-md';
      break;
    case 'outline':
      variantClasses = disabled
        ? 'border-2 border-slate-600 text-slate-500 cursor-not-allowed'
        : 'border-2 border-slate-400 text-cream hover:bg-slate-800/60 active:bg-slate-800';
      break;
    case 'ghost':
      variantClasses = disabled
        ? 'text-slate-600 cursor-not-allowed'
        : 'text-slate-300 hover:text-cream hover:bg-slate-800/40';
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
