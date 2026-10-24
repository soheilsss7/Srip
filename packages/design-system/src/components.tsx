import type {ButtonHTMLAttributes,HTMLAttributes,InputHTMLAttributes,ReactNode} from 'react';
export function Button(props:ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} className={`srip-button ${props.className??''}`}/>;}
export function Card({children,...props}:HTMLAttributes<HTMLElement>&{children:ReactNode}){return <section {...props} className={`srip-card ${props.className??''}`}>{children}</section>;}
export function Input(props:InputHTMLAttributes<HTMLInputElement>){return <input {...props} className={`srip-input ${props.className??''}`}/>;}
export function Badge({children,...props}:HTMLAttributes<HTMLSpanElement>&{children:ReactNode}){return <span {...props} className={`srip-badge ${props.className??''}`}>{children}</span>;}
export function Stack({children,...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){return <div {...props} className={`srip-stack ${props.className??''}`}>{children}</div>;}
export function EmptyState({title,description,children}:{title:string;description?:string;children?:ReactNode}){return <div className="srip-empty" role="status"><strong>{title}</strong>{description&&<span>{description}</span>}{children}</div>;}
export function ErrorState({message}:{message:string}){return <div className="srip-error" role="alert">{message}</div>;}
