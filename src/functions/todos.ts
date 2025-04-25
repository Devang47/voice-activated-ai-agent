import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { randomUUID } from 'crypto';

export const createTodo = async (title: string, description: string) => {
  const uuid = randomUUID();
  const todo = {
    id: uuid,
    title,
    description,
    timestamp: new Date().getTime(),
    completed: false,
  };

  await setDoc(doc(db, 'todos', uuid), todo);

  return JSON.stringify(todo);
};

export const updateTodo = async (
  id: string,
  title: string,
  description: string,
) => {
  const todo = {
    id,
    title,
    description,
  };

  await setDoc(doc(db, 'todos', id), todo);

  return JSON.stringify(todo);
};

export const markTodoAsComplete = async (id: string) => {
  await setDoc(doc(db, 'todos', id), {
    completed: true,
  });
  return 'success';
};

export const getTodos = async () => {
  const todosCollection = collection(db, 'todos');
  const todosSnapshot = await getDocs(todosCollection);

  const todosList = todosSnapshot.docs.map((doc) => {
    return {
      ...doc.data(),
    };
  });

  return todosList;
};

export const deleteTodo = async (id: string) => {
  const todoRef = doc(db, 'todos', id);

  await deleteDoc(todoRef);

  return 'success';
};
