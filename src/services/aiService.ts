import type { Question } from '../types'
import { GAME_CONSTANTS } from '../types'

const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY

const CATEGORIES = ['История', 'География', 'Наука', 'Искусство', 'Спорт', 'Кино', 'Музыка', 'Литература', 'Технологии', 'Природа']

// Генерируем уникальный seed для каждой игры
const generateUniqueSeed = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
}

export const generateQuestions = async (): Promise<Question[]> => {
  const total = GAME_CONSTANTS.TOTAL_QUESTIONS
  const uniqueSeed = generateUniqueSeed()
  
  const prompt = `Сгенерируй ${total} УНИКАЛЬНЫХ вопросов для викторины на русском языке.

КРИТИЧЕСКИ ВАЖНО: Вопросы должны быть АБСОЛЮТНО УНИКАЛЬНЫМИ и РАЗНЫМИ каждый раз!
Уникальный идентификатор запроса: ${uniqueSeed}

Используй этот идентификатор как seed для генерации НОВЫХ, НЕПОХОЖИХ вопросов.
НЕ ПОВТОРЯЙ типичные вопросы про столицы, планеты, авторов книг.
Придумай оригинальные, интересные вопросы на разные темы.

СЛОЖНОСТЬ:
- Вопросы 1-5: ОЧЕНЬ ПРОСТЫЕ (общеизвестные факты)
- Вопросы 6-15: СРЕДНИЕ (требуют базовой эрудиции)
- Вопросы 16-25: СЛОЖНЫЕ (требуют хороших знаний)
- Вопросы 26-30: ЭКСПЕРТНЫЕ (очень сложные)

Формат JSON:
[
  {
    "text": "Текст вопроса?",
    "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
    "correctIndex": 0,
    "category": "Категория"
  }
]

Категории: ${CATEGORIES.join(', ')}

Требования:
- Ровно 4 варианта ответа
- correctIndex от 0 до 3
- Разнообразные категории
- УНИКАЛЬНЫЕ вопросы, не повторяющиеся
- Только JSON без пояснений`

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 1.0, // Максимальная температура для разнообразия
        max_tokens: 8000,
        top_p: 0.95,
        frequency_penalty: 0.5, // Штраф за повторения
        presence_penalty: 0.5  // Штраф за похожие темы
      })
    })

    if (!response.ok) throw new Error('API Error')

    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON')

    const parsed = JSON.parse(jsonMatch[0])
    
    // Добавляем уникальные ID с временной меткой
    return parsed.slice(0, total).map((q: any, i: number) => ({
      id: `q-${uniqueSeed}-${i}`,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      category: q.category || CATEGORIES[i % CATEGORIES.length],
      questionNumber: i + 1
    }))
  } catch (error) {
    console.error('Generate error:', error)
    return generateFallbackQuestions(uniqueSeed)
  }
}

// Fallback вопросы тоже с рандомизацией
function generateFallbackQuestions(seed: string): Question[] {
  const allQuestions = [
    { text: 'Какой химический элемент обозначается символом Fe?', options: ['Железо', 'Фтор', 'Фосфор', 'Франций'], correctIndex: 0, category: 'Наука' },
    { text: 'В каком году пала Берлинская стена?', options: ['1987', '1989', '1991', '1993'], correctIndex: 1, category: 'История' },
    { text: 'Какая река самая длинная в мире?', options: ['Амазонка', 'Нил', 'Янцзы', 'Миссисипи'], correctIndex: 1, category: 'География' },
    { text: 'Кто написал "Преступление и наказание"?', options: ['Толстой', 'Достоевский', 'Чехов', 'Гоголь'], correctIndex: 1, category: 'Литература' },
    { text: 'Сколько планет в Солнечной системе?', options: ['7', '8', '9', '10'], correctIndex: 1, category: 'Наука' },
    { text: 'Какой город является столицей Японии?', options: ['Осака', 'Киото', 'Токио', 'Хиросима'], correctIndex: 2, category: 'География' },
    { text: 'В каком году началась Первая мировая война?', options: ['1912', '1914', '1916', '1918'], correctIndex: 1, category: 'История' },
    { text: 'Какой газ составляет большую часть атмосферы Земли?', options: ['Кислород', 'Азот', 'Углекислый газ', 'Аргон'], correctIndex: 1, category: 'Наука' },
    { text: 'Кто изобрёл телефон?', options: ['Эдисон', 'Тесла', 'Белл', 'Маркони'], correctIndex: 2, category: 'Технологии' },
    { text: 'Какое животное является символом WWF?', options: ['Тигр', 'Панда', 'Слон', 'Носорог'], correctIndex: 1, category: 'Природа' },
    { text: 'Столица Австралии?', options: ['Сидней', 'Мельбурн', 'Канберра', 'Брисбен'], correctIndex: 2, category: 'География' },
    { text: 'Кто написал "Войну и мир"?', options: ['Достоевский', 'Толстой', 'Пушкин', 'Тургенев'], correctIndex: 1, category: 'Литература' },
    { text: 'Какой океан самый большой?', options: ['Атлантический', 'Индийский', 'Тихий', 'Северный Ледовитый'], correctIndex: 2, category: 'География' },
    { text: 'Год основания компании Apple?', options: ['1974', '1976', '1978', '1980'], correctIndex: 1, category: 'Технологии' },
    { text: 'Какая страна подарила США Статую Свободы?', options: ['Англия', 'Германия', 'Франция', 'Испания'], correctIndex: 2, category: 'История' },
    { text: 'Сколько костей в теле взрослого человека?', options: ['186', '206', '226', '246'], correctIndex: 1, category: 'Наука' },
    { text: 'Кто режиссёр фильма "Титаник"?', options: ['Спилберг', 'Кэмерон', 'Скорсезе', 'Нолан'], correctIndex: 1, category: 'Кино' },
    { text: 'Какой металл жидкий при комнатной температуре?', options: ['Свинец', 'Олово', 'Ртуть', 'Цинк'], correctIndex: 2, category: 'Наука' },
    { text: 'Столица Канады?', options: ['Торонто', 'Монреаль', 'Ванкувер', 'Оттава'], correctIndex: 3, category: 'География' },
    { text: 'В каком году человек впервые высадился на Луну?', options: ['1965', '1967', '1969', '1971'], correctIndex: 2, category: 'История' },
    { text: 'Какая планета ближе всего к Солнцу?', options: ['Венера', 'Меркурий', 'Марс', 'Земля'], correctIndex: 1, category: 'Наука' },
    { text: 'Кто автор "Гарри Поттера"?', options: ['Стивен Кинг', 'Дж.К. Роулинг', 'Толкин', 'Льюис'], correctIndex: 1, category: 'Литература' },
    { text: 'Какое море самое солёное?', options: ['Чёрное', 'Красное', 'Мёртвое', 'Каспийское'], correctIndex: 2, category: 'География' },
    { text: 'Год изобретения Интернета (ARPANET)?', options: ['1965', '1969', '1973', '1977'], correctIndex: 1, category: 'Технологии' },
    { text: 'Какой элемент обозначается символом Au?', options: ['Серебро', 'Золото', 'Медь', 'Алюминий'], correctIndex: 1, category: 'Наука' },
    { text: 'Столица Бразилии?', options: ['Рио-де-Жанейро', 'Сан-Паулу', 'Бразилиа', 'Салвадор'], correctIndex: 2, category: 'География' },
    { text: 'Кто написал "Маленького принца"?', options: ['Экзюпери', 'Гюго', 'Дюма', 'Верн'], correctIndex: 0, category: 'Литература' },
    { text: 'Какая самая высокая гора в мире?', options: ['К2', 'Эверест', 'Канченджанга', 'Макалу'], correctIndex: 1, category: 'География' },
    { text: 'В каком году распался СССР?', options: ['1989', '1990', '1991', '1992'], correctIndex: 2, category: 'История' },
    { text: 'Какой витамин вырабатывается под действием солнца?', options: ['A', 'B', 'C', 'D'], correctIndex: 3, category: 'Наука' },
  ]
  
  // Перемешиваем вопросы используя seed
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
  
  return shuffled.slice(0, GAME_CONSTANTS.TOTAL_QUESTIONS).map((q, i) => ({
    id: `fallback-${seed}-${i}`,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    category: q.category,
    questionNumber: i + 1
  }))
}
