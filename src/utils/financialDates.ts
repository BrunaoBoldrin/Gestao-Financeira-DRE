const parseLocalDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatLocalDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateDueDateSchedule = (
  issueDate: string,
  paymentTerms: number[],
  firstDueDate?: string
): string[] => {
  const terms = paymentTerms.length > 0 ? paymentTerms : [0];
  const issue = parseLocalDate(issueDate) || new Date();
  issue.setHours(12, 0, 0, 0);

  const calculatedFirstDueDate = new Date(issue);
  calculatedFirstDueDate.setDate(calculatedFirstDueDate.getDate() + terms[0]);
  const scheduleStart = parseLocalDate(firstDueDate || '') || calculatedFirstDueDate;

  return terms.map((days) => {
    const dueDate = new Date(scheduleStart);
    dueDate.setDate(dueDate.getDate() + (days - terms[0]));
    return formatLocalDate(dueDate);
  });
};
