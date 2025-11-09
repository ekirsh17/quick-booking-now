import { format } from 'date-fns';
import { openingsTokens } from './openingsTokens';

interface WeekHeaderProps {
  date: Date;
  label: string;
}

export const WeekHeader = ({ date }: WeekHeaderProps) => {
  return (
    <div className={openingsTokens.grid.headerCell}>
      {format(date, 'EEE')}
    </div>
  );
};
