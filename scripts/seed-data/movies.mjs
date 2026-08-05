// Danh sách biên tập: CON NGƯỜI chọn phim, viết mô tả và gán thể loại.
// poster / backdrop / rating / duration KHÔNG gõ tay — `npm run seed:fetch-tmdb`
// tra từ chính trang phim công khai của TMDB rồi ghi vào tmdb.json.
//
// Vì sao không gõ tay ảnh: đường dẫn TMDB là chuỗi băm
// (/uiNPl4ONkYC1a0hGzIFLZSGST3O.jpg), không suy ra được từ tên phim. Gõ tay là
// đoán, mà đoán thì có cái 404 và tệ hơn là có cái 200 nhưng của phim khác.
//
// `genre` phải là một trong 8 mã đã có nhãn dịch trong src/i18n/locales/*.json —
// mã lạ sẽ hiện nguyên mã thay vì nhãn tiếng Việt.
//
// Pool cố ý nhiều hơn 24: phim nào TMDB không tra được sẽ bị loại, và bộ lọc thể
// loại cần đủ phim ở MỌI thể loại chứ không riêng Hành động.
export const MOVIE_POOL = [
  // --- Action ---
  {
    title: "Mad Max: Fury Road",
    genre: "Action",
    description:
      "A rebel warrior and a runaway queen flee a tyrant across the wasteland.",
  },
  {
    title: "Gladiator",
    genre: "Action",
    description:
      "A betrayed Roman general fights his way back from slavery to face the emperor.",
  },
  {
    title: "The Matrix",
    genre: "Action",
    description:
      "A hacker learns his world is a simulation and joins the war to break it.",
  },
  {
    title: "Mission: Impossible - Fallout",
    genre: "Action",
    description:
      "Ethan Hunt races to recover stolen plutonium before it ends three cities.",
  },
  {
    title: "Casino Royale",
    genre: "Action",
    description:
      "A newly promoted 007 must bankrupt a terrorist financier at the poker table.",
  },

  // --- Sci-Fi ---
  {
    title: "Blade Runner 2049",
    genre: "Sci-Fi",
    description:
      "A replicant hunter uncovers a secret that could end the fragile peace.",
  },
  {
    title: "Arrival",
    genre: "Sci-Fi",
    description:
      "A linguist must learn an alien language before the world goes to war.",
  },
  {
    title: "The Martian",
    genre: "Sci-Fi",
    description:
      "Stranded alone on Mars, an astronaut has to grow food and signal home.",
  },
  {
    title: "Edge of Tomorrow",
    genre: "Sci-Fi",
    description:
      "A soldier relives the same losing battle until he learns how to win it.",
  },
  {
    title: "Ex Machina",
    genre: "Sci-Fi",
    description:
      "A programmer is invited to test an android — and to be tested by her.",
  },

  // --- Horror ---
  {
    title: "Get Out",
    genre: "Horror",
    description:
      "A weekend with his girlfriend's family turns into a nightmare he can't leave.",
  },
  {
    title: "A Quiet Place",
    genre: "Horror",
    description:
      "A family survives blind predators that hunt by sound — one noise is fatal.",
  },
  {
    title: "Hereditary",
    genre: "Horror",
    description:
      "After a death in the family, a household unravels into something inherited.",
  },
  {
    title: "The Shining",
    genre: "Horror",
    description:
      "A winter caretaker and his family are alone in a hotel that is not empty.",
  },
  {
    title: "It",
    genre: "Horror",
    description:
      "Seven outcast kids face the thing that takes children from their town.",
  },

  // --- Drama ---
  {
    title: "Forrest Gump",
    genre: "Drama",
    description:
      "An ordinary man keeps running through three decades of American history.",
  },
  {
    title: "The Shawshank Redemption",
    genre: "Drama",
    description:
      "A banker sentenced to life keeps hope alive inside Shawshank prison.",
  },
  {
    title: "Whiplash",
    genre: "Drama",
    description:
      "A young drummer and a ruthless teacher push each other past breaking.",
  },
  {
    title: "The Green Mile",
    genre: "Drama",
    description:
      "Death row guards meet an inmate with an inexplicable gift for healing.",
  },
  {
    title: "Fight Club",
    genre: "Drama",
    description:
      "An insomniac and a soap salesman start a club that gets out of hand.",
  },

  // --- Comedy ---
  {
    title: "The Grand Budapest Hotel",
    genre: "Comedy",
    description:
      "A legendary concierge and his lobby boy are framed for murder.",
  },
  {
    title: "Deadpool",
    genre: "Comedy",
    description:
      "A wisecracking mercenary hunts the man who wrecked his life and his face.",
  },
  {
    title: "Knives Out",
    genre: "Comedy",
    description:
      "A detective sorts through a rich family's lies after the patriarch dies.",
  },
  {
    title: "Superbad",
    genre: "Comedy",
    description: "Two friends plan one last party before high school ends.",
  },

  // --- Crime ---
  {
    title: "Pulp Fiction",
    genre: "Crime",
    description:
      "Hitmen, a boxer and a gangster's wife cross paths in interlocking stories.",
  },
  {
    title: "The Godfather",
    genre: "Crime",
    description:
      "The youngest son of a mafia dynasty takes over the family business.",
  },
  {
    title: "Goodfellas",
    genre: "Crime",
    description:
      "Three decades of mob life, told from the inside until it turns on him.",
  },
  {
    title: "Se7en",
    genre: "Crime",
    description:
      "Two detectives track a killer staging murders after the deadly sins.",
  },
  {
    title: "The Departed",
    genre: "Crime",
    description: "A cop infiltrates the mob while a mole infiltrates the cops.",
  },

  // --- Animation ---
  {
    title: "Spirited Away",
    // Ghim id: TMDB đặt slug theo tên gốc Nhật nên tìm bằng tên tiếng Anh chỉ ra
    // toàn phim tài liệu ăn theo ("Uncovering Spirited Away", 24 phút).
    tmdbId: 129,
    genre: "Animation",
    description:
      "A girl must work in a spirit bathhouse to win her parents back.",
  },
  {
    title: "Toy Story",
    genre: "Animation",
    description:
      "A cowboy doll fears being replaced by a new space-ranger toy.",
  },
  {
    title: "Coco",
    genre: "Animation",
    description:
      "A boy crosses into the Land of the Dead to find his family's real story.",
  },
  {
    title: "Spider-Man: Into the Spider-Verse",
    genre: "Animation",
    description:
      "Miles Morales meets Spider-People from other dimensions to save his own.",
  },
  {
    title: "Your Name",
    // Ghim id: tìm "Your Name" từng khớp nhầm sang "Call Me by Your Name" — hai
    // phim sẽ đeo y hệt một bộ ảnh mà nhìn qua vẫn tưởng đúng.
    tmdbId: 372058,
    genre: "Animation",
    description:
      "Two teenagers keep waking up in each other's bodies, and cannot say why.",
  },

  // --- Romance ---
  {
    title: "Titanic",
    genre: "Romance",
    description:
      "Two passengers from different classes fall in love on a doomed crossing.",
  },
  {
    title: "Eternal Sunshine of the Spotless Mind",
    genre: "Romance",
    description:
      "A couple erase each other from memory, then fight to keep what is left.",
  },
  {
    title: "Call Me by Your Name",
    genre: "Romance",
    description:
      "One Italian summer changes a boy and his father's houseguest.",
  },
  {
    title: "Before Sunrise",
    genre: "Romance",
    description:
      "Two strangers get off a train in Vienna and talk until morning.",
  },
];
