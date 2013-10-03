'use strict';

/**
 * Convert a freedom promise-style interface into a
 * callback-style interface as used in the Chrome API.
 */
var promise2callback = function(object) {
  for (var prop in object) {
    if (object.hasOwnProperty(prop) && typeof object[prop] === 'function') {
      var orig = object[prop];
      var shim = function(base) {
        var args = [];
        for (var i = 1; i < arguments.length - 1; i++) {
          args.push(arguments[i]);
        }
        var cb = arguments[arguments.length - 1];
        if (typeof cb !== 'function') {
          args.push(cb);
          base.apply(object, args);
        } else {
          var promise = base.apply(object, args);
          promise.done(cb);
        }
      }.bind(object, orig);
      object[prop] = shim;
    }
  }
  return object;
}

function makeLogger(level) {
  var logFunc = console[level];
  if (logFunc) {
    return logFunc.bind(console);
  }
  return function () {
    var s = '[' + level.toUpperCase() + '] ';
    for (var i=0, ii=arguments[i]; i<arguments.length; s+=ii+' ', ii=arguments[++i]) {
      ii = typeof ii === 'string' ? ii :
           ii instanceof Error ? ii.toString() :
           JSON.stringify(ii);
    }
    console.log(s);
  };
}

//== XXX can get rid of these when we include lodash: ==//
function isUndefined(val) {
  return typeof val == 'undefined';
}

function isDefined(val) {
  return typeof val != 'undefined';
}

function cloneDeep(val) {
  return JSON.parse(JSON.stringify(val)); // quick and dirty
}

/**
 * This function extracts the cryptographic key used to encrypt the data media
 * type (mid:data) from the provided sdp headers string. If no key can be
 * determined, this function returns null.
 * 
 * For example, given the below header:
 * 
 * a=crypto:1 AES_CM_128_HMAC_SHA1_80
 * inline:FZoIzaV2KYVbd1mO445wH9NNIcE3tbKz0X0AtEok
 * 
 * This function will return:
 * 
 * FZoIzaV2KYVbd1mO445wH9NNIcE3tbKz0X0AtEok
 * 
 * See http://tools.ietf.org/html/rfc4568#section-4 and
 * http://tools.ietf.org/html/rfc4568#section-9.1
 * 
 * @param msg
 * @returns
 */
function extractCryptoKey(sdpHeaders) {
  // Process all the SDP header lines
  var lines = sdpHeaders.split(/\r?\n/),
      currentLine,
      midDataFound = false,
      keyParams,
      keyParam,
      i, j;
  
  for (i in lines) {
    currentLine = lines[i];
    if (!midDataFound) {
      if (currentLine === "a=mid:data") {
        midDataFound = true;
      }
    } else {
      if (currentLine.indexOf("a=crypto:1") === 0) {
        keyParams = currentLine.substring(currentLine.indexOf(" ", 11) + 1).split(" ");
        for (j in keyParams) {
          keyParam = keyParams[j];
          if (keyParam.indexOf("inline:" === 0)) {
            return keyParam.substring(7);
          }
        }
      }
    }
  }
  
  return null;
}

//======================================================//

var adjectives, nouns;
adjectives = [ "abandoned", "able", "absolute", "adorable", "adventurous",
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

nouns = [ "account", "achiever", "acoustics", "act", "action", "activity",
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
