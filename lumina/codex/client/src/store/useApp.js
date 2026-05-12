import { create } from 'zustand';
export const useApp = create((set)=>({ token:localStorage.getItem('token'), user:null, setAuth:(token,user)=>{localStorage.setItem('token',token);set({token,user});} }));
