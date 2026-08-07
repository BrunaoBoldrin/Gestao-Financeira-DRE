import React from 'react';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string;
  sizeClass?: string;
  textClass?: string;
  className?: string;
}

export const getUserInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  sizeClass = 'w-8 h-8',
  textClass = 'text-xs',
  className = ''
}) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full border border-[#C5A059] object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Iniciais de ${name}`}
      className={`${sizeClass} rounded-full border border-[#C5A059] bg-[#0b1c30] text-[#ffdea5] flex items-center justify-center font-black shrink-0 ${textClass} ${className}`}
    >
      {getUserInitials(name)}
    </div>
  );
};
