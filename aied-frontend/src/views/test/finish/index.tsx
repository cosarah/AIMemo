// aied-frontend/src/views/test/practice/finish.tsx
import { useState, useEffect } from 'react';
import { useRouter } from '@/hooks';
import './index.scss';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BACKEND_URL } from '@/constants';

interface Feedback {
  text: string;
  score: number;
}

interface Message {
  text: string;
  from: 'user' | 'ai';
}

const welcome: Message = {
  text: 'Welcome to the finish page!',
  from: 'ai',
};

function Finish() {
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>({
    text: '',
    score: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  // 从浏览器获取card_id

  // 根据card_id获取反馈
  useEffect(() => {
      setIsLoading(true);
      fetch(`${BACKEND_URL}/feedback/`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(
          {
            card_id: localStorage.getItem('card_id'),
            username: localStorage.getItem('username')
          }
        )
          }
        )
      .then(response => response.json())
      .then(data => {
        setFeedback(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error:', error);
        setIsLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 这里需要调用AI聊天库或API，然后将响应添加到messages中
    setMessages([...messages, { text: input, from: 'user' }]);
    try {
        setIsResponding(true);
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          card_id: localStorage.getItem('card_id'),
          username: localStorage.getItem('username')
        }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        setMessages([...messages, { text: data.message, from: 'ai' }]);
    } catch (error) {
        setMessages([...messages, {text: input, from: 'user' }, { text: 'An error occurred', from: 'ai' }]);
        console.error('There was a problem with the fetch operation:', error);
    } finally {
        setIsResponding(false);
        setInput('');
    }
  };

  return (
    <div>
      <h1>Finish</h1>
      <button onClick={() => router.push('/')}>back to home</button>
      <button onClick={() => router.push('/practice')}>Practice</button>
      <button onClick={() => router.push('/learn')}>Learn</button>
      <div className='learn'>
        <div className="learning-materials">
          <h1>Feedback</h1>
          {isLoading && <div>Loading...</div>}
          {!isLoading && feedback.text && (
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {feedback.text}
          </ReactMarkdown>)}
        </div>
        <div className="ai-chat">
          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.from}`}>
                {message.text}
              </div>
            ))}
            {isResponding && <div className="message ai">thinking...</div>}
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your feedback here..."
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Finish;
