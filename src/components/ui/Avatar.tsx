import { cn } from '../../lib/utils'
import { avatarStyle, initials } from '../../lib/utils'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'xl'
  className?: string
}

const sizeMap = { sm: 'w-6 h-6 text-[10px] rounded-[7px]', md: 'w-[30px] h-[30px] text-[11.5px] rounded-[9px]', xl: 'w-[90px] h-[66px] text-[26px] rounded-[12px]' }

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn('inline-grid flex-none place-items-center font-bold text-white', sizeMap[size], className)}
      style={{ background: avatarStyle(name).replace('background:', '') }}
    >
      {initials(name)}
    </span>
  )
}
