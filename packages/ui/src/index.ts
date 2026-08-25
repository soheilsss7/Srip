export type StatusTone='neutral'|'success'|'warning'|'danger';
export const statusTone=(score:number):StatusTone=>score>=75?'success':score>=50?'warning':'danger';
