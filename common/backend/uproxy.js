/**
 * uproxy.js
 *
 * This is the primary backend script. It maintains both in-memory state and
 * checkpoints information to local storage.

 * In-memory state includes:
 *  - Roster, which is a list of contacts, always synced with XMPP friend lists.
 *  - Instances, which is a list of active UProxy installs.
 */
'use strict';

// TODO: find a better place for this, and then reference from here.
var adjectives = [ "abandoned", "able", "absolute", "adorable", "adventurous",
  "academic", "acceptable", "acclaimed", "accomplished", "accurate", "aching",
  "acidic", "acrobatic", "active", "actual", "adept", "admirable", "admired",
  "adolescent", "adorable", "adored", "advanced", "afraid", "affectionate",
  "aged", "aggravating", "aggressive", "agile", "agitated", "agonizing",
  "agreeable", "ajar", "alarmed", "alarming", "alert", "alienated", "alive",
  "all", "altruistic", "amazing", "ambitious", "ample", "amused", "amusing",
  "anchored", "ancient", "angelic", "angry", "anguished", "animated", "annual",
  "another", "antique", "anxious", "any", "apprehensive", "appropriate", "apt",
  "arctic", "arid", "aromatic", "artistic", "ashamed", "assured",
  "astonishing", "athletic", "attached", "attentive", "attractive", "austere",
  "authentic", "authorized", "automatic", "avaricious", "average", "aware",
  "awesome", "awful", "awkward", "babyish", "bad", "back", "baggy", "bare",
  "barren", "basic", "beautiful", "belated", "beloved", "beneficial", "better",
  "best", "bewitched", "big", "big-hearted", "biodegradable", "bite-sized",
  "bitter", "black", "black-and-white", "bland", "blank", "blaring", "bleak",
  "blind", "blissful", "blond", "blue", "blushing", "bogus", "boiling", "bold",
  "bony", "boring", "bossy", "both", "bouncy", "bountiful", "bowed", "brave",
  "breakable", "brief", "bright", "brilliant", "brisk", "broken", "bronze",
  "brown", "bruised", "bubbly", "bulky", "bumpy", "buoyant", "burdensome",
  "burly", "bustling", "busy", "buttery", "buzzing", "calculating", "calm",
  "candid", "canine", "capital", "carefree", "careful", "careless", "caring",
  "cautious", "cavernous", "celebrated", "charming", "cheap", "cheerful",
  "cheery", "chief", "chilly", "chubby", "circular", "classic", "clean",
  "clear", "clear-cut", "clever", "close", "closed", "cloudy", "clueless",
  "clumsy", "cluttered", "coarse", "cold", "colorful", "colorless", "colossal",
  "comfortable", "common", "compassionate", "competent", "complete", "complex",
  "complicated", "composed", "concerned", "concrete", "confused", "conscious",
  "considerate", "constant", "content", "conventional", "cooked", "cool",
  "cooperative", "coordinated", "corny", "corrupt", "costly", "courageous",
  "courteous", "crafty", "crazy", "creamy", "creative", "creepy", "criminal",
  "crisp", "critical", "crooked", "crowded", "cruel", "crushing", "cuddly",
  "cultivated", "cultured", "cumbersome", "curly", "curvy", "cute",
  "cylindrical", "damaged", "damp", "dangerous", "dapper", "daring", "darling",
  "dark", "dazzling", "dead", "deadly", "deafening", "dear", "dearest",
  "decent", "decimal", "decisive", "deep", "defenseless", "defensive",
  "defiant", "deficient", "definite", "definitive", "delayed", "delectable",
  "delicious", "delightful", "delirious", "demanding", "dense", "dental",
  "dependable", "dependent", "descriptive", "deserted", "detailed",
  "determined", "devoted", "different", "difficult", "digital", "diligent",
  "dim", "dimpled", "dimwitted", "direct", "disastrous", "discrete",
  "disfigured", "disgusting", "disloyal", "dismal", "distant", "downright",
  "dreary", "dirty", "disguised", "dishonest", "dismal", "distant", "distinct",
  "distorted", "dizzy", "dopey", "doting", "double", "downright", "drab",
  "drafty", "dramatic", "dreary", "droopy", "dry", "dual", "dull", "dutiful",
  "each", "eager", "earnest", "early", "easy", "easy-going", "ecstatic",
  "edible", "educated", "elaborate", "elastic", "elated", "elderly",
  "electric", "elegant", "elementary", "elliptical", "embarrassed",
  "embellished", "eminent", "emotional", "empty", "enchanted", "enchanting",
  "energetic", "enlightened", "enormous", "enraged", "entire", "envious",
  "equal", "equatorial", "essential", "esteemed", "ethical", "euphoric",
  "even", "evergreen", "everlasting", "every", "evil", "exalted", "excellent",
  "exemplary", "exhausted", "excitable", "excited", "exciting", "exotic",
  "expensive", "experienced", "expert", "extraneous", "extroverted",
  "extra-large", "extra-small", "fabulous", "failing", "faint", "fair",
  "faithful", "fake", "false", "familiar", "famous", "fancy", "fantastic",
  "far", "faraway", "far-flung", "far-off", "fast", "fat", "fatal", "fatherly",
  "favorable", "favorite", "fearful", "fearless", "feisty", "feline", "female",
  "feminine", "few", "fickle", "filthy", "fine", "finished", "firm", "first",
  "firsthand", "fitting", "fixed", "flaky", "flamboyant", "flashy", "flat",
  "flawed", "flawless", "flickering", "flimsy", "flippant", "flowery",
  "fluffy", "fluid", "flustered", "focused", "fond", "foolhardy", "foolish",
  "forceful", "forked", "formal", "forsaken", "forthright", "fortunate",
  "fragrant", "frail", "frank", "frayed", "free", "French", "fresh",
  "frequent", "friendly", "frightened", "frightening", "frigid", "frilly",
  "frizzy", "frivolous", "front", "frosty", "frozen", "frugal", "fruitful",
  "full", "fumbling", "functional", "funny", "fussy", "fuzzy", "gargantuan",
  "gaseous", "general", "generous", "gentle", "genuine", "giant", "giddy",
  "gigantic", "gifted", "giving", "glamorous", "glaring", "glass", "gleaming",
  "gleeful", "glistening", "glittering", "gloomy", "glorious", "glossy",
  "glum", "golden", "good", "good-natured", "gorgeous", "graceful", "gracious",
  "grand", "grandiose", "granular", "grateful", "grave", "gray", "great",
  "greedy", "green", "gregarious", "grim", "grimy", "gripping", "grizzled",
  "gross", "grotesque", "grouchy", "grounded", "growing", "growling", "grown",
  "grubby", "gruesome", "grumpy", "guilty", "gullible", "gummy", "hairy",
  "half", "handmade", "handsome", "handy", "happy", "happy-go-lucky", "hard",
  "hard-to-find", "harmful", "harmless", "harmonious", "harsh", "hasty",
  "hateful", "haunting", "healthy", "heartfelt", "hearty", "heavenly", "heavy",
  "hefty", "helpful", "helpless", "hidden", "hideous", "high", "high-level",
  "hilarious", "hoarse", "hollow", "homely", "honest", "honorable", "honored",
  "hopeful", "horrible", "hospitable", "hot", "huge", "humble", "humiliating",
  "humming", "humongous", "hungry", "hurtful", "husky", "icky", "icy", "ideal",
  "idealistic", "identical", "idle", "idiotic", "idolized", "ignorant", "ill",
  "illegal", "ill-fated", "ill-informed", "illiterate", "illustrious",
  "imaginary", "imaginative", "immaculate", "immaterial", "immediate",
  "immense", "impassioned", "impeccable", "impartial", "imperfect",
  "imperturbable", "impish", "impolite", "important", "impossible",
  "impractical", "impressionable", "impressive", "improbable", "impure",
  "inborn", "incomparable", "incompatible", "incomplete", "inconsequential",
  "incredible", "indelible", "inexperienced", "indolent", "infamous",
  "infantile", "infatuated", "inferior", "infinite", "informal", "innocent",
  "insecure", "insidious", "insignificant", "insistent", "instructive",
  "insubstantial", "intelligent", "intent", "intentional", "interesting",
  "internal", "international", "intrepid", "ironclad", "irresponsible",
  "irritating", "itchy", "jaded", "jagged", "jam-packed", "jaunty", "jealous",
  "jittery", "joint", "jolly", "jovial", "joyful", "joyous", "jubilant",
  "judicious", "juicy", "jumbo", "junior", "jumpy", "juvenile",
  "kaleidoscopic", "keen", "key", "kind", "kindhearted", "kindly", "klutzy",
  "knobby", "knotty", "knowledgeable", "knowing", "known", "kooky", "kosher",
  "lame", "lanky", "large", "last", "lasting", "late", "lavish", "lawful",
  "lazy", "leading", "lean", "leafy", "left", "legal", "legitimate", "light",
  "lighthearted", "likable", "likely", "limited", "limp", "limping", "linear",
  "lined", "liquid", "little", "live", "lively", "livid", "loathsome", "lone",
  "lonely", "long", "long-term", "loose", "lopsided", "lost", "loud",
  "lovable", "lovely", "loving", "low", "loyal", "lucky", "lumbering",
  "luminous", "lumpy", "lustrous", "luxurious", "mad", "made-up",
  "magnificent", "majestic", "major", "male", "mammoth", "married",
  "marvelous", "masculine", "massive", "mature", "meager", "mealy", "mean",
  "measly", "meaty", "medical", "mediocre", "medium", "meek", "mellow",
  "melodic", "memorable", "menacing", "merry", "messy", "metallic", "mild",
  "milky", "mindless", "miniature", "minor", "minty", "miserable", "miserly",
  "misguided", "misty", "mixed", "modern", "modest", "moist", "monstrous",
  "monthly", "monumental", "moral", "mortified", "motherly", "motionless",
  "mountainous", "muddy", "muffled", "multicolored", "mundane", "murky",
  "mushy", "musty", "muted", "mysterious", "naive", "narrow", "nasty",
  "natural", "naughty", "nautical", "near", "neat", "necessary", "needy",
  "negative", "neglected", "negligible", "neighboring", "nervous", "new",
  "next", "nice", "nifty", "nimble", "nippy", "nocturnal", "noisy", "nonstop",
  "normal", "notable", "noted", "noteworthy", "novel", "noxious", "numb",
  "nutritious", "nutty", "obedient", "obese", "oblong", "oily", "oblong",
  "obvious", "occasional", "odd", "oddball", "offbeat", "offensive",
  "official", "old", "old-fashioned", "only", "open", "optimal", "optimistic",
  "opulent", "orange", "orderly", "organic", "ornate", "ornery", "ordinary",
  "original", "other", "our", "outlying", "outgoing", "outlandish",
  "outrageous", "outstanding", "oval", "overcooked", "overdue", "overjoyed",
  "onerlooked", "palatable", "pale", "paltry", "parallel", "parched",
  "partial", "passionate", "past", "pastel", "peaceful", "peppery", "perfect",
  "perfumed", "periodic", "perky", "personal", "pertinent", "pesky",
  "pessimistic", "petty", "phony", "physical", "piercing", "pink", "pitiful",
  "plain", "plaintive", "plastic", "playful", "pleasant", "pleased",
  "pleasing", "plump", "plush", "polished", "polite", "political", "pointed",
  "pointless", "poised", "poor", "popular", "portly", "posh", "positive",
  "possible", "potable", "powerful", "powerless", "practical", "precious",
  "present", "prestigious", "pretty", "precious", "previous", "pricey",
  "prickly", "primary", "prime", "pristine", "private", "prize", "probable",
  "productive", "profitable", "profuse", "proper", "proud", "prudent",
  "punctual", "pungent", "puny", "pure", "purple", "pushy", "putrid",
  "puzzled", "puzzling", "quaint", "qualified", "quarrelsome", "quarterly",
  "queasy", "querulous", "questionable", "quick", "quick-witted", "quiet",
  "quintessential", "quirky", "quixotic", "quizzical", "radiant", "ragged",
  "rapid", "rare", "rash", "raw", "recent", "reckless", "rectangular", "ready",
  "real", "realistic", "reasonable", "red", "reflecting", "regal", "regular",
  "reliable", "relieved", "remarkable", "remorseful", "remote", "repentant",
  "required", "respectful", "responsible", "repulsive", "revolving",
  "rewarding", "rich", "rigid", "right", "ringed", "ripe", "roasted", "robust",
  "rosy", "rotating", "rotten", "rough", "round", "rowdy", "royal", "rubbery",
  "rundown", "ruddy", "rude", "runny", "rural", "rusty", "sad", "safe",
  "salty", "same", "sandy", "sane", "sarcastic", "sardonic", "satisfied",
  "scaly", "scarce", "scared", "scary", "scented", "scholarly", "scientific",
  "scornful", "scratchy", "scrawny", "second", "secondary", "second-hand",
  "secret", "self-assured", "self-reliant", "selfish", "sentimental",
  "separate", "serene", "serious", "serpentine", "several", "severe", "shabby",
  "shadowy", "shady", "shallow", "shameful", "shameless", "sharp",
  "shimmering", "shiny", "shocked", "shocking", "shoddy", "short",
  "short-term", "showy", "shrill", "shy", "sick", "silent", "silky", "silly",
  "silver", "similar", "simple", "simplistic", "sinful", "single", "sizzling",
  "skeletal", "skinny", "sleepy", "slight", "slim", "slimy", "slippery",
  "slow", "slushy", "small", "smart", "smoggy", "smooth", "smug", "snappy",
  "snarling", "sneaky", "sniveling", "snoopy", "sociable", "soft", "soggy",
  "solid", "somber", "some", "spherical", "sophisticated", "sore", "sorrowful",
  "soulful", "soupy", "sour", "Spanish", "sparkling", "sparse", "specific",
  "spectacular", "speedy", "spicy", "spiffy", "spirited", "spiteful",
  "splendid", "spotless", "spotted", "spry", "square", "squeaky", "squiggly",
  "stable", "staid", "stained", "stale", "standard", "starchy", "stark",
  "starry", "steep", "sticky", "stiff", "stimulating", "stingy", "stormy",
  "straight", "strange", "steel", "strict", "strident", "striking", "striped",
  "strong", "studious", "stunning", "stupendous", "stupid", "sturdy",
  "stylish", "subdued", "submissive", "substantial", "subtle", "suburban",
  "sudden", "sugary", "sunny", "super", "superb", "superficial", "superior",
  "supportive", "sure-footed", "surprised", "suspicious", "svelte", "sweaty",
  "sweet", "sweltering", "swift", "sympathetic", "tall", "talkative", "tame",
  "tan", "tangible", "tart", "tasty", "tattered", "taut", "tedious", "teeming",
  "tempting", "tender", "tense", "tepid", "terrible", "terrific", "testy",
  "thankful", "that", "these", "thick", "thin", "third", "thirsty", "this",
  "thorough", "thorny", "those", "thoughtful", "threadbare", "thrifty",
  "thunderous", "tidy", "tight", "timely", "tinted", "tiny", "tired", "torn",
  "total", "tough", "traumatic", "treasured", "tremendous", "tragic",
  "trained", "tremendous", "triangular", "tricky", "trifling", "trim",
  "trivial", "troubled", "true", "trusting", "trustworthy", "trusty",
  "truthful", "tubby", "turbulent", "twin", "ugly", "ultimate", "unacceptable",
  "unaware", "uncomfortable", "uncommon", "unconscious", "understated",
  "unequaled", "uneven", "unfinished", "unfit", "unfolded", "unfortunate",
  "unhappy", "unhealthy", "uniform", "unimportant", "unique", "united",
  "unkempt", "unknown", "unlawful", "unlined", "unlucky", "unnatural",
  "unpleasant", "unrealistic", "unripe", "unruly", "unselfish", "unsightly",
  "unsteady", "unsung", "untidy", "untimely", "untried", "untrue", "unused",
  "unusual", "unwelcome", "unwieldy", "unwilling", "unwitting", "unwritten",
  "upbeat", "upright", "upset", "urban", "usable", "used", "useful", "useless",
  "utilized", "utter", "vacant", "vague", "vain", "valid", "valuable", "vapid",
  "variable", "vast", "velvety", "venerated", "vengeful", "verifiable",
  "vibrant", "vicious", "victorious", "vigilant", "vigorous", "villainous",
  "violet", "violent", "virtual", "virtuous", "visible", "vital", "vivacious",
  "vivid", "voluminous", "wan", "warlike", "warm", "warmhearted", "warped",
  "wary", "wasteful", "watchful", "waterlogged", "watery", "wavy", "wealthy",
  "weak", "weary", "webbed", "wee", "weekly", "weepy", "weighty", "weird",
  "welcome", "well-documented", "well-groomed", "well-informed", "well-lit",
  "well-made", "well-off", "well-to-do", "well-worn", "wet", "which",
  "whimsical", "whirlwind", "whispered", "white", "whole", "whopping",
  "wicked", "wide", "wide-eyed", "wiggly", "wild", "willing", "wilted",
  "winding", "windy", "wingedp", "wiry", "wise", "witty", "wobbly", "woeful",
  "wonderful", "wooden", "woozy", "wordy", "worldly", "worn", "worried",
  "worrisome", "worse", "worst", "worthless", "worthwhile", "worthy",
  "wrathful", "wretched", "writhing", "wrong", "wry", "yawning", "yearly",
  "yellow", "yellowish", "young", "youthful", "yummy", "zany", "zealous",
  "zesty", "zigzag" ];

var nouns = [ "account", "achiever", "acoustics", "act", "action", "activity",
  "actor", "addition", "adjustment", "advertisement", "advice", "aftermath",
  "afternoon", "afterthought", "agreement", "air", "airplane", "airport",
  "alarm", "alley", "amount", "amusement", "anger", "angle", "animal",
  "answer", "ant", "ants", "apparatus", "apparel", "apple", "apples",
  "appliance", "approval", "arch", "argument", "arithmetic", "arm", "army",
  "art", "attack", "attempt", "attention", "attraction", "aunt", "authority",
  "babies", "baby", "back", "badge", "bag", "bait", "balance", "ball",
  "balloon", "balls", "banana", "band", "base", "baseball", "basin", "basket",
  "basketball", "bat", "bath", "battle", "bead", "beam", "bean", "bear",
  "bears", "beast", "bed", "bedroom", "beds", "bee", "beef", "beetle",
  "beggar", "beginner", "behavior", "belief", "believe", "bell", "bells",
  "berry", "bike", "bikes", "bird", "birds", "birth", "birthday", "bit",
  "bite", "blade", "blood", "blow", "board", "boat", "boats", "body", "bomb",
  "bone", "book", "books", "boot", "border", "bottle", "boundary", "box",
  "boy", "boys", "brain", "brake", "branch", "brass", "bread", "breakfast",
  "breath", "brick", "bridge", "brother", "brothers", "brush", "bubble",
  "bucket", "building", "bulb", "bun", "burn", "burst", "bushes", "business",
  "butter", "button", "cabbage", "cable", "cactus", "cake", "cakes",
  "calculator", "calendar", "camera", "camp", "can", "cannon", "canvas", "cap",
  "caption", "car", "card", "care", "carpenter", "carriage", "cars", "cart",
  "cast", "cat", "cats", "cattle", "cause", "cave", "celery", "cellar",
  "cemetery", "cent", "chain", "chair", "chairs", "chalk", "chance", "change",
  "channel", "cheese", "cherries", "cherry", "chess", "chicken", "chickens",
  "children", "chin", "church", "circle", "clam", "class", "clock", "clocks",
  "cloth", "cloud", "clouds", "clover", "club", "coach", "coal", "coast",
  "coat", "cobweb", "coil", "collar", "color", "comb", "comfort", "committee",
  "company", "comparison", "competition", "condition", "connection", "control",
  "cook", "copper", "copy", "cord", "cork", "corn", "cough", "country",
  "cover", "cow", "cows", "crack", "cracker", "crate", "crayon", "cream",
  "creator", "creature", "credit", "crib", "crime", "crook", "crow", "crowd",
  "crown", "crush", "cry", "cub", "cup", "current", "curtain", "curve",
  "cushion", "dad", "daughter", "day", "death", "debt", "decision", "deer",
  "degree", "design", "desire", "desk", "destruction", "detail", "development",
  "digestion", "dime", "dinner", "dinosaurs", "direction", "dirt", "discovery",
  "discussion", "disease", "disgust", "distance", "distribution", "division",
  "dock", "doctor", "dog", "dogs", "doll", "dolls", "donkey", "door",
  "downtown", "drain", "drawer", "dress", "drink", "driving", "drop", "drug",
  "drum", "duck", "ducks", "dust", "ear", "earth", "earthquake", "edge",
  "education", "effect", "egg", "eggnog", "eggs", "elbow", "end", "engine",
  "error", "event", "example", "exchange", "existence", "expansion",
  "experience", "expert", "eye", "eyes", "face", "fact", "fairies", "fall",
  "family", "fan", "fang", "farm", "farmer", "father", "father", "faucet",
  "fear", "feast", "feather", "feeling", "feet", "fiction", "field", "fifth",
  "fight", "finger", "finger", "fire", "fireman", "fish", "flag", "flame",
  "flavor", "flesh", "flight", "flock", "floor", "flower", "flowers", "fly",
  "fog", "fold", "food", "foot", "force", "fork", "form", "fowl", "frame",
  "friction", "friend", "friends", "frog", "frogs", "front", "fruit", "fuel",
  "furniture", "game", "garden", "gate", "geese", "ghost", "giants", "giraffe",
  "girl", "girls", "glass", "glove", "glue", "goat", "gold", "goldfish",
  "good-bye", "goose", "government", "governor", "grade", "grain",
  "grandfather", "grandmother", "grape", "grass", "grip", "ground", "group",
  "growth", "guide", "guitar", "gun", "hair", "haircut", "hall", "hammer",
  "hand", "hands", "harbor", "harmony", "hat", "hate", "head", "health",
  "hearing", "heart", "heat", "help", "hen", "hill", "history", "hobbies",
  "hole", "holiday", "home", "honey", "hook", "hope", "horn", "horse",
  "horses", "hose", "hospital", "hot", "hour", "house", "houses", "humor",
  "hydrant", "ice", "icicle", "idea", "impulse", "income", "increase",
  "industry", "ink", "insect", "instrument", "insurance", "interest",
  "invention", "iron", "island", "jail", "jam", "jar", "jeans", "jelly",
  "jellyfish", "jewel", "join", "joke", "journey", "judge", "juice", "jump",
  "kettle", "key", "kick", "kiss", "kite", "kitten", "kittens", "kitty",
  "knee", "knife", "knot", "knowledge", "laborer", "lace", "ladybug", "lake",
  "lamp", "land", "language", "laugh", "lawyer", "lead", "leaf", "learning",
  "leather", "leg", "legs", "letter", "letters", "lettuce", "level", "library",
  "lift", "light", "limit", "line", "linen", "lip", "liquid", "list",
  "lizards", "loaf", "lock", "locket", "look", "loss", "love", "low", "lumber",
  "lunch", "lunchroom", "machine", "magic", "maid", "mailbox", "man",
  "manager", "map", "marble", "mark", "market", "mask", "mass", "match",
  "meal", "measure", "meat", "meeting", "memory", "men", "metal", "mice",
  "middle", "milk", "mind", "mine", "minister", "mint", "minute", "mist",
  "mitten", "mom", "money", "monkey", "month", "moon", "morning", "mother",
  "motion", "mountain", "mouth", "move", "muscle", "music", "nail", "name",
  "nation", "neck", "need", "needle", "nerve", "nest", "net", "news", "night",
  "noise", "north", "nose", "note", "notebook", "number", "nut", "oatmeal",
  "observation", "ocean", "offer", "office", "oil", "operation", "opinion",
  "orange", "oranges", "order", "organization", "ornament", "oven", "owl",
  "owner", "page", "pail", "pain", "paint", "pan", "pancake", "paper",
  "parcel", "parent", "park", "part", "partner", "party", "passenger", "paste",
  "patch", "payment", "peace", "pear", "pen", "pencil", "person", "pest",
  "pet", "pets", "pickle", "picture", "pie", "pies", "pig", "pigs", "pin",
  "pipe", "pizzas", "place", "plane", "planes", "plant", "plantation",
  "plants", "plastic", "plate", "play", "playground", "pleasure", "plot",
  "plough", "pocket", "point", "poison", "police", "polish", "pollution",
  "popcorn", "porter", "position", "pot", "potato", "powder", "power", "price",
  "print", "prison", "process", "produce", "profit", "property", "prose",
  "protest", "pull", "pump", "punishment", "purpose", "push", "quarter",
  "quartz", "queen", "question", "quicksand", "quiet", "quill", "quilt",
  "quince", "quiver", "rabbit", "rabbits", "rail", "railway", "rain",
  "rainstorm", "rake", "range", "rat", "rate", "ray", "reaction", "reading",
  "reason", "receipt", "recess", "record", "regret", "relation", "religion",
  "representative", "request", "respect", "rest", "reward", "rhythm", "rice",
  "riddle", "rifle", "ring", "rings", "river", "road", "robin", "rock", "rod",
  "roll", "roof", "room", "root", "rose", "route", "rub", "rule", "run",
  "sack", "sail", "salt", "sand", "scale", "scarecrow", "scarf", "scene",
  "scent", "school", "science", "scissors", "screw", "sea", "seashore", "seat",
  "secretary", "seed", "selection", "self", "sense", "servant", "shade",
  "shake", "shame", "shape", "sheep", "sheet", "shelf", "ship", "shirt",
  "shock", "shoe", "shoes", "shop", "show", "side", "sidewalk", "sign", "silk",
  "silver", "sink", "sister", "sisters", "size", "skate", "skin", "skirt",
  "sky", "slave", "sleep", "sleet", "slip", "slope", "smash", "smell", "smile",
  "smoke", "snail", "snails", "snake", "snakes", "sneeze", "snow", "soap",
  "society", "sock", "soda", "sofa", "son", "song", "songs", "sort", "sound",
  "soup", "space", "spade", "spark", "spiders", "sponge", "spoon", "spot",
  "spring", "spy", "square", "squirrel", "stage", "stamp", "star", "start",
  "statement", "station", "steam", "steel", "stem", "step", "stew", "stick",
  "sticks", "stitch", "stocking", "stomach", "stone", "stop", "store", "story",
  "stove", "stranger", "straw", "stream", "street", "stretch", "string",
  "structure", "substance", "sugar", "suggestion", "suit", "summer", "sun",
  "support", "surprise", "sweater", "swim", "swing", "system", "table", "tail",
  "talk", "tank", "taste", "tax", "teaching", "team", "teeth", "temper",
  "tendency", "tent", "territory", "test", "texture", "theory", "thing",
  "things", "thought", "thread", "thrill", "throat", "throne", "thumb",
  "thunder", "ticket", "tiger", "time", "tin", "title", "toad", "toe", "toes",
  "tomatoes", "tongue", "tooth", "toothbrush", "toothpaste", "top", "touch",
  "town", "toy", "toys", "trade", "trail", "train", "trains", "tramp",
  "transport", "tray", "treatment", "tree", "trees", "trick", "trip",
  "trouble", "trousers", "truck", "trucks", "tub", "turkey", "turn", "twig",
  "twist", "umbrella", "uncle", "underwear", "unit", "use", "vacation",
  "value", "van", "vase", "vegetable", "veil", "vein", "verse", "vessel",
  "vest", "view", "visitor", "voice", "volcano", "volleyball", "voyage",
  "walk", "wall", "war", "wash", "waste", "watch", "water", "wave", "waves",
  "wax", "way", "wealth", "weather", "week", "weight", "wheel", "whip",
  "whistle", "wilderness", "wind", "window", "wine", "wing", "winter", "wire",
  "wish", "woman", "women", "wood", "wool", "word", "work", "worm", "wound",
  "wren", "wrench", "wrist", "writer", "writing", "yak", "yam", "yard", "yarn",
  "year", "yoke", "zebra", "zephyr", "zinc", "zipper", "zoo" ];


var DEBUG = true; // XXX get this from somewhere else
console.log('Uproxy backend, running in worker ' + self.location.href);

var log = {
  debug: DEBUG ? makeLogger('debug') : function(){},
  error: makeLogger('error')
};

var identity = freedom.identity();
var storage = freedom.storage();
var client = freedom.uproxyclient();
var server = freedom.uproxyserver();

var window = {};  //XXX: Makes chrome debugging saner, not needed otherwise.

// enum of state ids that we need to worry about.
var StateEntries = {
  ME: 'me',
  OPTIONS: 'options',
  INSTANCEIDS: 'instanceIds', // only exists for local storage state.
  INSTANCES: 'instances',   // only exists for in-memory state.
};

var Trust = {
  NO: 'no',
  REQUESTED: 'requested',
  YES: 'yes'
};
var TrustType = {
  PROXY: 'asProxy',
  CLIENT: 'asClient'
};

// Initial empty state
var RESET_STATE = {
  // debugging stuff
  "_debug": DEBUG,  // debug state.
  "_msgLog": [],  //

  // A table from network identifier to your status on that network
  // (online/offline/idle, etc)
  "identityStatus": {},
  "me": {},         // Local client's information.
  "roster": {},     // Merged contact lists from each identity provider.
  "instances": {},  // instanceId -> instance. Active UProxy installations.

  // Options coming from local storage and setable by the options page.
  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  }
};
var state = cloneDeep(RESET_STATE);

// Mapping functions
function instanceToClient(instanceId) {
  // TODO: client = state[StateEntries.INSTANCES][
  var instance = state.instances[instanceId];
  if (!instance) {
    return null;
  }
  return instance.currentClient;
}

function clientToInstance(clientId) {
  // TODO:
  return null
}

// Mock data for what may live in local storage. (note: values will be strings
// too, via JSON interpretation)
var LOCAL_STORAGE_EXAMPLE = {
  "me": { "description": "l's Laptop",
          "instanceId": "mememmemememsdhodafslkffdaslkjfds",
        },
  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  },
  // Note invariant: for each instanceIds[X] there should be an entry:
  // "instance/X": { ... } which holds out local stored knowledge about that
  // instance id.
  "instanceIds": [
    "ssssssssshjafdshjadskfjlkasfs",
    "rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn",
    "qqqqjksdklflsdjkljkfdsa"
  ],
  "instance/ssssssssshjafdshjadskfjlkasfs": {
    "name": "S",
    "description": "S's home desktop",
    "annotation": "Cool S who has high bandwidth",
    "instanceId": "ssssssssshjafdshjadskfjlkasfs",
    "userId": "s@gmail.com",
    "network": "google",
    "keyhash" : "HASHssssjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "yes", // "no" | "requested" | "yes"
        "client": "no" // "no" | "requested" | "yes"
      }
    // "status" {
       // "activeProxy": boolean
       // "activeClient": boolean
    // }
  },
  "instance/r@fmail.com": {
    "name": "R",
    "description": "R's laptop",
    "annotation": "R is who is repressed",
    "instanceId": "rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn",
    "userId": "r@facebook.com",
    "network": "facebook",
    "keyhash" : "HASHrrrjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "no",
        "client": "yes"
      }
  },
  "instance/qqqqjksdklflsdjkljkfdsa": {
    "name": "S",
    "description": "S's laptop",
    "annotation": "S who is on qq",
    "instanceId": "qqqqjksdklflsdjkljkfdsa",
    "userId": "s@qq",
    "network": "manual",
    "keyhash" : "HASHqqqqqjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "no",
        "client": "no"
      }
  }
};

function _loadFromStorage(key, callback, defaultIfUndefined) {
  storage.get(key).done(function (result) {
    if (isDefined(result)) {
      callback(JSON.parse(result));
    } else {
      callback(defaultIfUndefined);
    }
  });
}

function _saveToStorage(key, val, callback) {
  storage.set(key, JSON.stringify(val)).done(callback);
}

function _loadStateFromStorage(state) {
  var key;
  var instanceIds = [];

  // Set the saves |me| state and |options|.
  key = StateEntries.ME;
  _loadFromStorage(key, function(v){ state[key] = v; }, RESET_STATE[key]);
  key = StateEntries.OPTIONS;
  _loadFromStorage(key, function(v){ state[key] = v; }, RESET_STATE[key]);

  // Create an instanceId if we don't have one yet.
  if (state.me['instanceId'] == undefined) {
    state.me.instanceId = "";
    state.me.description = null;
    // Just generate 20 random 8-bit numbers, print them out in hex.
    var val, hex, id;
    for (var i = 0; i < 20; i++) {
      val = Math.floor(Math.random() * 256);
      hex = val.toString(16);
      state.me.instanceId = state.me.instanceId +
          ("00".substr(0, 2 - hex.length) + hex);
      if (i < 4) {
        id = (i & 1) ? adjectives[val] : nouns[val];
        if (state.me.description != null) {
          state.me.description = state.me.description + " " + id;
        } else {
          state.me.description = id;
        }
      }
    }
  }

  // Set the state |instances| from the local storage entries.
  var instancesTable = {};
  state[StateEntries.INSTANCES] = instancesTable;
  key = StateEntries.INSTANCEIDS;
  _loadFromStorage(key, function(instanceIds) {
    console.log("instanceIds:", instanceIds);
    for (var i = 0; i < instanceIds.length ; i++) {
      var key = instanceIds[i];
      _loadFromStorage(key, function(v) {
        if(v === null) {
          console.error("_loadStateFromStorage: undefined key:", key);
        } else {
          instancesTable[key] = v;
        }},
      null);
    }
  }, []);

  // TODO: remove these and propegate changes.
  // state.allowGiveTo = {};
  // state.pendingGiveTo = {};
  // state.canGetFrom = {};
  // state.pendingGetFrom = {};
  state.currentSessionsToInitiate = {};
  state.currentSessionsToRelay = {};
  log.debug('_loadStateFromStorage: saving state: ' + JSON.stringify(state));
}

function _saveStateToStorage() {
  // TODO
  console.error("Not yet implemented");
}

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
setTimeout(onload, 0);

function _loginInit(cb) {
  identity.login({
    agent: 'uproxy',
    version: '0.1',
    url: 'https://github.com/UWNetworksLab/UProxy',
    interactive: false
    //network: ''
  }).done(function (loginRet) {
    if (cb) {
      cb();
    }
  });
};

/**
 * Called once when uproxy.js is loaded.
 */
function onload() {
  // Check if the app is installed.
  _loginInit();
  /**
  _loginInit(function() {
    identity.logout(null).done(function() {
      setTimeout(_loginInit, 3000);
    });
  });
  **/
  _loadStateFromStorage(state);

  // Define freedom bindings.
  freedom.on('reset', function () {
    log.debug('reset');
    // TODO: sign out of Google Talk and other networks.
    state = cloneDeep(RESET_STATE);
    _loadStateFromStorage(state);
  });

  // Called from extension whenever the user clicks opens the extension popup.
  // The intent is to reset its model - but this may or may not always be
  // necessary. Improvements to come.
  freedom.on('open-popup', function () {
    log.debug('open-popup');
    log.debug('state:', state);
    // Send the extension an empty state object.
    freedom.emit('state-change', [{op: 'replace', path: '', value: state}]);
  });

  // Update local user's online status.
  identity.on('onStatus', function(data) {
    log.debug('onStatus: data:' + JSON.stringify(data));
    if (data.userId) {
      state.identityStatus[data.network] = data;
      freedom.emit('state-change', [{op: 'add', path: '/identityStatus/'+data.network, value: data}]);
      if (!state.me[data.userId]) {
        state.me[data.userId] = {userId: data.userId};
      }
    }
  });

  identity.on('onChange', function(data) {
    // log.debug('onChange: data:' + JSON.stringify(data));
    if (data.userId && state.me[data.userId]) {
      // My card changed
      state.me[data.userId] = data;
      freedom.emit('state-change', [{op: 'add', path: '/me/'+data.userId, value: data}]);
      notifyClient();
      notifyServer();
    } else {
      // Must be a buddy
      _updateInstanceIdsOnChange(state.roster[data.userId], data);
      state.roster[data.userId] = data;
      // Determine networks and uproxy state.
      freedom.emit('state-change', [{op: 'add', path: '/roster/'+data.userId, value: data}]);
    }
  });

  identity.on('onMessage', function (msg) {
    state._msgLog.push(msg);
    freedom.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
    var payload = {};
    try {
      payload = JSON.parse(msg.message);
      msg.message = payload.message;
      msg.data = payload.data;
    } catch(e) {
      msg.unparseable = msg.message;
    }
    _handleMessage(msg, false);  // beingSent = false
  });

  freedom.on('login', function(network) {
    identity.login({
      agent: 'uproxy',
      version: '0.1',
      url: 'https://github.com/UWNetworksLab/UProxy',
      interactive: true,
      network: network
    });
  });

  freedom.on('logout', function(network) {
    identity.logout(null, network);
  });

  freedom.on('send-message', function (msg) {
    identity.sendMessage(msg.to, msg.message);
    _handleMessage(msg, true);  // beingSent = true
  });

  freedom.on('ignore', function (userId) {
    // delete state.pendingGiveTo[userId];
    // TODO: fix.
    // _saveToStorage('pendingGiveTo', state.pendingGiveTo);
    // freedom.emit('state-change', [
      // {op: 'remove', path: '/pendingGiveTo/'+userId}
    // ]);
  });

  freedom.on('invite-friend', function (userId) {
    identity.sendMessage(userId, "Join UProxy!");
  });

  freedom.on('echo', function (msg) {
    state._msgLog.push(msg);
    freedom.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
  });

  freedom.on('change-option', function (data) {
    state.options[data.key] = data.value;
    _saveToStorage('options', state.options);
    freedom.emit('state-change', [{op: 'replace', path: '/options/'+data.key, value: data.value}]);
    notifyClient();
    notifyServer();
  });

  client.on('fromClient', function(data) {
    log.debug('Connection Setup:', data);
    var contact = state.currentSessionsToInitiate['*'];
    if (!contact) {
      return log.error("Client connection received but no active connections.");
    }
    identity.sendMessage(contact, JSON.stringify({message: 'connection-setup', data: data}));
  });

  server.on('fromServer', function(data) {
    log.debug('server response:', data);
    var contact = state.currentSessionsToRelay[data.to];
    if(!contact) {
      return log.error("Response requested to inactive client: " + data.to);
    }
    identity.sendMessage(contact, JSON.stringify({message: 'connection-setup-response', data: data}));
  });

};

var notifyClient = function() {
  if (client.started && !('*' in state.currentSessionsToInitiate)) {
    client.emit('stop');
    client.started = false;
  } else if (!client.started && ('*' in state.currentSessionsToInitiate)) {
    client.emit('start', {host: '127.0.0.1', port: 9999});
    client.started = true;
  }
};

var notifyServer = function() {
  if (server.started && Object.keys(state.currentSessionsToRelay).length == 0) {
    server.emit('stop');
    server.started = fale;
  } else if (!server.started && Object.keys(state.currentSessionsToRelay).length > 0) {
    server.emit('start');
    server.started = true;
  }
}

// These message handlers must operate on a per-instance basis rather than a
// per-user basis...
// Each of these functions should take parameters (msg, contact)
// Some of these message handlers deal with modifying trust values.
// Others deal with actually starting and stopping a proxy connection.

// Trust mutation.
var TrustOp = {
  'allow': Trust.YES,
  'request-access': Trust.REQUESTED,
  'deny': Trust.NO
};

var _msgReceivedHandlers = {
  'start-proxying': _handleProxyStartReceived,
  'connection-setup': _handleConnectionSetupReceived,
  'connection-setup-response': _handleConnectionSetupResponseReceived,
  'request-instance-id' : _handleRequestInstanceIdReceived,
  'request-instance-id-response' : _handleRequestInstanceIdResponseReceived
};

/**
 * Bi-directional message handler.
 *
 * @isSent - True if message is being sent. False if received.
 */
function _handleMessage(msg, beingSent) {
  log.debug('Handling ' + (beingSent ? 'sent' : 'received') + ' message...');
  console.log(msg);
  // Check if this is a trust modification.
  var trustValue = TrustOp[msg.message];  // NO, REQUESTED, or YES
  if (trustValue) {
    // Access request and Grants go in opposite directions.
    var asProxy = 'allow' == msg.message ? !beingSent : beingSent;
    _updateTrust(msg.to, asProxy, trustValue);
    // TODO freedom emit this stuff and save to storage
    return true;
  }

  // Check if it's a proxy connection message.
  log.debug('Dealing with a proxy connection?!?', msg);
  var handler = null;
  if (!beingSent) {
    handler = _msgReceivedHandlers[msg.message];
  }
  if (!handler) {
    log.error('No handler for sent message: ', msg);
    return false;
  }
  handler(msg, msg.to);
}

// A simple predicate function to see if we can talk to this client.
function _isMessageableUproxy(client) {
  var retval = (/* [issue 21] client.network == 'google' && */ client.status == 'online'
      && client.clientId.indexOf('/uproxy') > 0);
  log.debug('_isMessageableUproxy(' + JSON.stringify(client) + '):' + retval);
  return retval;
}

// Look for a !messageable->messageable transition, and dispatch a
// query if needed.
function _updateInstanceIdsOnChange(prior, current) {
  var should_dump = false;
  for (var client in current.clients) {
    var cur = current.clients[client];
    var prev = prior? prior.clients[client] : null;
    if (cur.network == 'google') {
      should_dump = true;
    }
    // TODO: when thing settle down, don't be so chatty.
    if (_isMessageableUproxy(cur)) { //  && (!prev || !_isMessageableUproxy(prev))) {
      _dispatchInstanceIdQuery(current.userId, cur);
    }
  }
  if (should_dump) {
    log.debug('_updateInstanceIdsOnChange(..,current clients="' +
        JSON.stringify(current.clients) + '")');
  }
}

function _dispatchInstanceIdQuery(user, client) {
  log.debug('_dispatchInstanceIdQuery(' + user + ', ' + JSON.stringify(client) + ')');
  if (client['network'] == undefined || (client.network != 'loopback' && client.network != 'manual')) {
    log.debug('_dispatchInstanceIdQuery:  identity.sendMessage(' +
              client.clientId + ', {message: request-instance-id})')
    identity.sendMessage(client.clientId,
                         JSON.stringify({ message: 'request-instance-id' }));
  }
}

function _updateTrust(clientId, asProxy, trustValue) {
  var instance = clientToInstance(clientId);
  if (!instance) {
    log.debug('Could not find instance corresponding to client: ' + clientId);
    return false;
  }
  var trust = asProxy? instance.trust.asProxy : instance.trust.asClient;
  log.debug('Modifying trust value: ', instance, trust);
  trust = trustValue;
  // TODO freedom emit? and local storage?
  return true;
}

function _handleProxyStartReceived(msg, contact) {
  // TODO: Access Check on if it's allowed.
  state.currentSessionsToRelay[msg['fromClientId']] = msg['fromClientId'];
  _saveToStorage('currentSessionsToRelay', state.currentSessionsToRelay);
  notifyServer();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToRelay/' +
      msg['fromClientId'], value: contact}]);
}

function _handleConnectionSetupReceived(msg, contact) {
  msg.data.from = msg['fromClientId'];
  server.emit('toServer', msg.data);

  // Figure out the crypto key
  var cryptoKey = null;
  var data = JSON.parse(msg.data.data);
  if (data.sdp) {
    cryptoKey = extractCryptoKey(data.sdp);
  } else {
    log.debug("Data did not contain sdp headers", msg);
  }

  // Compare against the verified crypto keys
  var verifiedCryptoKeysKey = contact.userId + ".verifiedCryptoKeys";
  var verificationRequired = false;
  if (cryptoKey) {
    // TODO: rename to Hash: this is not the key, this is the hash of the key.
    _loadFromStorage(verifiedCryptoKeysKey, function(verifiedCryptoKeys) {
      log.debug("Comparing crypto key against verified keys for this user");
      if (cryptoKey in verifiedCryptoKeys) {
        log.debug("Crypto key already verified, proceed to establishing connection");
      } else {
        log.debug("Crypto key not yet verified, need to start video chat");
      }
    }, {});
  } else {
    log.error("Didn't receive crypto key in SDP headers, not sure what to do");
  }
}

function _handleConnectionSetupResponseReceived(msg, clientId) {
  // msg.data.from = msg['fromClientId'];
  // client.emit('toClient', msg.data);
}

// Handle sending -----------------------------------------------------------

function _handleStartProxyingSent(msg, clientId) {
  //TODO replace with better handling of manual identity
  if (msg.to.indexOf('manual') >= 0) {
    return false;
  }
  state.currentSessionsToInitiate['*'] = msg['to'];
  _saveToStorage('currentSessionsToInitiate', state.currentSessionsToInitiate);
  notifyClient();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToInitiate/*', value: contact}]);
}

function _handleRequestInstanceIdReceived(msg, clientId) {
  // Respond to the user with our clientId.
  // TODO(mollyling): consider rate-limiting responses, in case the
  // other side's flaking out.
  log.debug('_handleRequestInstanceIdReceived(' + JSON.stringify(msg)); // + ', ' + JSON.stringify(contact));
  var instanceIdMsg = JSON.stringify({
      message: 'request-instance-id-response',
      data: '' + state.me.instanceId});
  console.log(instanceIdMsg);
  identity.sendMessage(msg.fromClientId, instanceIdMsg);

}
function _handleRequestInstanceIdResponseReceived(msg, clientId) {
  // Update |state| with the instance ID, and emit a state-change
  // notification to tell the UI what's up.
  log.debug('_handleRequestInstanceIdResponseReceived(' + JSON.stringify(msg));
  var instanceId = msg.data;
  // Install the instanceId for the client.
  var user = state.roster[msg.fromUserId];
  if (!user) {
    log.error("user does not exist in roster for instanceId: " + instanceId);
    return false;
  }
  var client = user.clients[msg.fromClientId];
  if (!client) {
    log.error('client does not exist! User: ' + user);
    return false;
  }
  // Update the client's instanceId for the extension.
  // freedom.emit('state-change', [{
      // op: client.instanceId ? 'replace' : 'add',
      // path: '/roster/' + msg.fromUserId + '/clients/' + msg.fromClientId +  '/instanceId',
      // value: instanceId
  // }]);
  client.instanceId = instanceId;
  freedom.emit('state-change', [{
      op: client.instanceId ? 'replace' : 'add',
      path: '/roster/' + msg.fromUserId,
      value: state.roster[msg.fromUserId]
  }]);
  return true;
}
