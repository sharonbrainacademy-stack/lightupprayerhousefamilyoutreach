/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReadingPlanDay, ReadingPlanProgress } from '../types';
import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export const THIRTY_DAYS_READING_PLAN: ReadingPlanDay[] = [
  // ==================== WEEK 1: AWAKENING & HOLY SPIRIT FIRE ====================
  {
    day: 1,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "Keeping the Altar Fire Burning",
    scriptureReference: "Leviticus 6:12-13, Romans 12:11",
    keyVerse: "Leviticus 6:13",
    keyVerseText: "The fire shall ever be burning upon the altar; it shall never go out.",
    devotionalInsight: "The altar of your heart is designed to carry the continual presence and power of God. Fire doesn't stay lit on its own; it requires daily wood—devotion, prayer, and consecrated surrender. Today, invite the Holy Spirit to rekindle every cold ember in your prayer life.",
    prayerPoints: [
      "Lord, ignite a fresh fire upon the altar of my prayer life that will never go out.",
      "Purge away every spiritual lethargy, lukewarmness, and distraction in Jesus' name.",
      "Fill me afresh with the Holy Ghost and power for daily living."
    ],
    declaration: "The fire of God upon my life will never go out. I am spiritually fervent and serving the Lord with divine passion!",
    bibleGatewayQuery: "Leviticus+6:12-13,Romans+12:11"
  },
  {
    day: 2,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "Power When the Spirit Comes",
    scriptureReference: "Acts 1:4-8, Joel 2:28-29",
    keyVerse: "Acts 1:8",
    keyVerseText: "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth.",
    devotionalInsight: "Divine assignment cannot be fulfilled by human talent or fleshly effort. The Holy Spirit is God's endowment of heavenly power (dunamis) to make you an effective witness and instrument of supernatural change.",
    prayerPoints: [
      "Holy Spirit, fall afresh on me and release your divine power into every area of my life.",
      "Empower me to be a bold, uncompromising witness of Jesus Christ in my family and community.",
      "Open my spiritual ears to hear your promptings throughout this day."
    ],
    declaration: "I do not walk in weakness; I am clothed with supernatural power by the Holy Spirit to accomplish God's will.",
    bibleGatewayQuery: "Acts+1:4-8,Joel+2:28-29"
  },
  {
    day: 3,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "The Outpouring & Transformation",
    scriptureReference: "Acts 2:1-4, 38-39",
    keyVerse: "Acts 2:2-4",
    keyVerseText: "And suddenly there came a sound from heaven as of a rushing mighty wind... And they were all filled with the Holy Ghost, and began to speak with other tongues, as the Spirit gave them utterance.",
    devotionalInsight: "Pentecost was not just an ancient event; the promise of the Holy Spirit is for you and your children today. When the Spirit fills you, fear is replaced by divine boldness, confusion is shattered by clarity, and ordinary speech becomes prophetic utterance.",
    prayerPoints: [
      "Let a sudden rushing mighty wind of the Holy Spirit sweep through my home and assembly.",
      "Impart a deeper baptism of the Holy Ghost and spiritual utterances into my prayer closet.",
      "Break every barrier resisting the fullness of the Holy Spirit in my life."
    ],
    declaration: "The Holy Spirit resides in me in fullness; I am an unshakeable vessel of revival in my generation.",
    bibleGatewayQuery: "Acts+2:1-4,Acts+2:38-39"
  },
  {
    day: 4,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "A Living Sacrifice & Transformed Mind",
    scriptureReference: "Romans 12:1-2, Romans 12:11",
    keyVerse: "Romans 12:1-2",
    keyVerseText: "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service.",
    devotionalInsight: "True spiritual power flows out of consecrated surrender. When you yield your thoughts, schedule, and appetites to God, the Holy Spirit renews your mind to discern His good, pleasing, and perfect will.",
    prayerPoints: [
      "Father, I present my body and soul to You as a holy, living sacrifice today.",
      "Renew my mind through Your Word; deliver me from conformity to the patterns of this world.",
      "Give me discernment to know and walk in Your perfect will at all times."
    ],
    declaration: "My mind is renewed by God's truth. I reject worldly patterns and walk in holy, acceptable surrender to Christ.",
    bibleGatewayQuery: "Romans+12:1-2,Romans+12:11"
  },
  {
    day: 5,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "Stirring Up the Divine Gift Within",
    scriptureReference: "2 Timothy 1:6-7, 1 Corinthians 12:4-11",
    keyVerse: "2 Timothy 1:6-7",
    keyVerseText: "Wherefore I put thee in remembrance that thou stir up the gift of God, which is in thee... For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
    devotionalInsight: "God has deposited spiritual gifts and divine potential inside you. Don't let inactivity, intimidation, or fear bury your mantle. Fan the flame through prayer in the Spirit, faith-filled action, and steadfast love.",
    prayerPoints: [
      "Lord, I stir up every dormant spiritual gift, calling, and capacity inside me.",
      "I renounce and cast out the spirit of fear, timidity, and doubt in the name of Jesus.",
      "Release the spirit of power, unconditional love, and a sound, disciplined mind over my destiny."
    ],
    declaration: "God has not given me a spirit of fear, but of power, love, and a sound mind. My spiritual gifts are active and fruitful!",
    bibleGatewayQuery: "2+Timothy+1:6-7,1+Corinthians+12:4-11"
  },
  {
    day: 6,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "The God Who Answers by Fire",
    scriptureReference: "1 Kings 18:36-39, Hebrews 12:28-29",
    keyVerse: "1 Kings 18:38",
    keyVerseText: "Then the fire of the LORD fell, and consumed the burnt sacrifice, and the wood, and the stones, and the dust, and licked up the water that was in the trench.",
    devotionalInsight: "Elijah repaired the broken altar of the Lord before the fire fell. When we align our lives with God's covenant, He answers by fire—silencing every mockery, destroying satanic altars, and revealing that the Lord, He is God!",
    prayerPoints: [
      "O Lord God of Abraham, Isaac, and Israel, answer my prayers by fire and silence every opposition.",
      "Let Your fire consume every demonic altar and obstacle fighting my family.",
      "Prove Your sovereignty in my situation so that all may know You alone are God."
    ],
    declaration: "The God who answers by fire is my God! Every counterfeit power is confounded and dismantled before His presence.",
    bibleGatewayQuery: "1+Kings+18:36-39,Hebrews+12:28-29"
  },
  {
    day: 7,
    week: 1,
    weekTitle: "Awakening & Holy Spirit Fire",
    theme: "Continual Infilling & Spiritual Melody",
    scriptureReference: "Ephesians 5:18-20, Luke 24:49",
    keyVerse: "Ephesians 5:18-19",
    keyVerseText: "And be not drunk with wine, wherein is excess; but be filled with the Spirit; Speaking to yourselves in psalms and hymns and spiritual songs, singing and making melody in your heart to the Lord.",
    devotionalInsight: "The Christian life is not sustained by yesterday's baptism alone; it requires a perpetual, daily drinking of the Spirit. Cultivate an atmosphere of thanksgiving, spiritual melody, and joyful reverence wherever you go.",
    prayerPoints: [
      "Lord Jesus, fill me to overflowing with Your Spirit today and every day of this month.",
      "Put a fresh new song of praise and adoration in my mouth.",
      "Let my home be a sanctuary of spiritual atmosphere and heavenly melody."
    ],
    declaration: "I am continuously filled with the Holy Ghost. Joy, thanksgiving, and divine melody overflow from my heart!",
    bibleGatewayQuery: "Ephesians+5:18-20,Luke+24:49"
  },

  // ==================== WEEK 2: IDENTITY, DIVINE PURPOSE & ASSIGNMENT ====================
  {
    day: 8,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "Ordained Before the Womb",
    scriptureReference: "Jeremiah 1:4-10, Galatians 1:15",
    keyVerse: "Jeremiah 1:5",
    keyVerseText: "Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee, and I ordained thee a prophet unto the nations.",
    devotionalInsight: "You are not an accident or a biological coincidence. Before your parents met, God saw you, named you, sanctified you, and assigned you a kingdom mission. Never measure your worth by human standards; measure it by God's eternal ordination.",
    prayerPoints: [
      "Heavenly Father, unveil the full dimension of the divine assignment You ordained for my life.",
      "Deliver me from the trap of comparing myself with others or feeling inadequate.",
      "Put Your words in my mouth to root out strongholds and build God's kingdom."
    ],
    declaration: "I was known, sanctified, and ordained by God before the foundation of the world. I walk in divine purpose without fear!",
    bibleGatewayQuery: "Jeremiah+1:4-10,Galatians+1:15"
  },
  {
    day: 9,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "Fearfully and Wonderfully Made",
    scriptureReference: "Psalm 139:1-18",
    keyVerse: "Psalm 139:14",
    keyVerseText: "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.",
    devotionalInsight: "God took His time crafting your personality, gifts, and destiny. He knows every thought before it is spoken and holds every tear in His bottle. Live with the holy confidence of a beloved child of the King.",
    prayerPoints: [
      "Thank You, Lord, for crafting me with intentionality, wisdom, and deep love.",
      "Heal my heart from rejection, low self-esteem, and negative words spoken over my identity.",
      "Lead me in the way everlasting and align my steps with Your divine blueprint."
    ],
    declaration: "I am fearfully and wonderfully made by the Almighty God. His thoughts toward me are precious and countless!",
    bibleGatewayQuery: "Psalm+139:1-18"
  },
  {
    day: 10,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "Divine Direction & A Hope-Filled Future",
    scriptureReference: "Proverbs 3:5-6, Jeremiah 29:11-13",
    keyVerse: "Proverbs 3:5-6",
    keyVerseText: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    devotionalInsight: "When we stop leaning on limited human logic and commit our plans into God's hands, He straightens crooked paths. God's thoughts for you are thoughts of peace, not of evil, to give you an expected end.",
    prayerPoints: [
      "Father, I hand over every decision regarding my family, career, and ministry to Your direct guidance.",
      "Uproot any pride or self-reliance; grant me the meekness to follow Your voice.",
      "Fulfill Your plans of peace, health, and a glorious future in my generation."
    ],
    declaration: "I trust in the Lord with all my heart. He directs my steps, opens supernatural doors, and secures my future.",
    bibleGatewayQuery: "Proverbs+3:5-6,Jeremiah+29:11-13"
  },
  {
    day: 11,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "Chosen in Christ with Spiritual Blessings",
    scriptureReference: "Ephesians 1:3-14",
    keyVerse: "Ephesians 1:3",
    keyVerseText: "Blessed be the God and Father of our Lord Jesus Christ, who hath blessed us with all spiritual blessings in heavenly places in Christ.",
    devotionalInsight: "In Christ Jesus, you are not trying to get blessed; you have already been blessed with every spiritual blessing in heavenly places. You are adopted, redeemed through His blood, forgiven, and sealed by the Holy Spirit.",
    prayerPoints: [
      "Lord, open the eyes of my understanding to comprehend the riches of my inheritance in Christ.",
      "I lay claim to every spiritual blessing assigned to my destiny from heaven.",
      "Thank You for adopting me as a royal heir and sealing me with the Holy Spirit of promise."
    ],
    declaration: "I am blessed with all spiritual blessings in Christ. I walk in forgiveness, redemption, and covenant favor daily.",
    bibleGatewayQuery: "Ephesians+1:3-14"
  },
  {
    day: 12,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "God's Masterpiece Created for Good Works",
    scriptureReference: "Ephesians 2:8-10, Colossians 1:9-12",
    keyVerse: "Ephesians 2:10",
    keyVerseText: "For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in them.",
    devotionalInsight: "The Greek word for workmanship is 'poiema'—a poem, a masterpiece. God has authored your life to demonstrate His grace and good works. Step into the opportunities He has prepared for you today.",
    prayerPoints: [
      "Father, let my life reflect Your beauty, wisdom, and excellence in all I do.",
      "Connect me to the pre-ordained good works and people You have assigned for me.",
      "Grant me fruitful labor and victory in every assignment in my hands."
    ],
    declaration: "I am God's masterpiece created in Christ Jesus. I walk into divine appointments and bear lasting fruit!",
    bibleGatewayQuery: "Ephesians+2:8-10,Colossians+1:9-12"
  },
  {
    day: 13,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "Chosen & Appointed to Bear Lasting Fruit",
    scriptureReference: "John 15:1-16",
    keyVerse: "John 15:16",
    keyVerseText: "Ye have not chosen me, but I have chosen you, and ordained you, that ye should go and bring forth fruit, and that your fruit should remain: that whatsoever ye shall ask of the Father in my name, he may give it you.",
    devotionalInsight: "Abiding in the Vine (Jesus) is the secret to effortless, abundant fruitfulness. As long as you remain connected to Christ through His Word and prayer, your prayers carry answered authority and your fruit endures.",
    prayerPoints: [
      "Lord Jesus, teach me to abide in You deeply every hour of every day.",
      "Prune away any unfruitful branch, attitude, or habit that hinders my spiritual growth.",
      "Make my prayers, soul-winning, and service bring forth everlasting fruit."
    ],
    declaration: "I abide in Christ the true Vine. I am fruitful, my fruit remains, and my prayers receive heavenly answers!",
    bibleGatewayQuery: "John+15:1-16"
  },
  {
    day: 14,
    week: 2,
    weekTitle: "Identity, Purpose & Divine Assignment",
    theme: "Covenant People & Chosen Generation",
    scriptureReference: "Deuteronomy 7:6-9, Genesis 12:1-3, 1 Peter 2:9",
    keyVerse: "1 Peter 2:9",
    keyVerseText: "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light.",
    devotionalInsight: "You belong to a royal priesthood. The covenant of Abraham is your heritage through Christ. God's faithfulness endures to a thousand generations of those who love Him and keep His commandments.",
    prayerPoints: [
      "Lord, thank You for establishing Your eternal covenant of blessing and protection over my household.",
      "Let the Abrahamic blessing make me a source of blessing to my city and generation.",
      "Empower me to show forth the praises of Him who called me out of darkness into marvelous light."
    ],
    declaration: "I am a chosen generation and a royal priest! The covenant blessings of Abraham speak for me and my children.",
    bibleGatewayQuery: "Deuteronomy+7:6-9,Genesis+12:1-3,1+Peter+2:9"
  },

  // ==================== WEEK 3: PRAYER, SPIRITUAL WARFARE & BREAKTHROUGH ====================
  {
    day: 15,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "Call Upon Me and I Will Answer",
    scriptureReference: "Jeremiah 33:1-3, Matthew 7:7-11",
    keyVerse: "Jeremiah 33:3",
    keyVerseText: "Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.",
    devotionalInsight: "Prayer is not a religious monologue; it is an open invitation from the Creator to access heavenly secrets, solutions, and supernatural breakthroughs. When you call in faith, God answers beyond human imagination.",
    prayerPoints: [
      "Father, I call upon You with my whole heart; show me great and mighty secrets for my next level.",
      "Open the floodgates of divine answers to long-standing prayer requests in my family.",
      "Give me a heart that seeks You continually with unwavering faith."
    ],
    declaration: "As I call upon the Lord, He answers me! Great, mighty, and unsearchable blessings are unveiled in my life.",
    bibleGatewayQuery: "Jeremiah+33:1-3,Matthew+7:7-11"
  },
  {
    day: 16,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "The Secret Place & Supernatural Reward",
    scriptureReference: "Matthew 6:5-18, Psalm 27:4-5",
    keyVerse: "Matthew 6:6",
    keyVerseText: "But thou, when thou prayest, enter into thy closet, and when thou hast shut thy door, pray to thy Father which is in secret; and thy Father which seeth in secret shall reward thee openly.",
    devotionalInsight: "Your public power is determined by your private devotion. Shut the door to distractions, social media noise, and human applause, and seek your Father in secret. He will reward your life openly and unmistakably.",
    prayerPoints: [
      "Lord, draw me deeper into the secret place of communion and intimacy with You.",
      "Deliver me from hypocrisy, distraction, and spiritual tiredness in the place of prayer.",
      "Let the rewards of secret devotion manifest openly in my health, peace, and spiritual authority."
    ],
    declaration: "My secret place with God is vibrant and guarded. My Father who sees in secret rewards me openly!",
    bibleGatewayQuery: "Matthew+6:5-18,Psalm+27:4-5"
  },
  {
    day: 17,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "The Fervent Prayer of the Righteous",
    scriptureReference: "James 5:13-18, 1 Kings 18:41-46",
    keyVerse: "James 5:16b",
    keyVerseText: "The effectual fervent prayer of a righteous man availeth much.",
    devotionalInsight: "Elijah was a human being just like us, yet he prayed earnestly and opened and shut the heavens. Fervent, faith-filled prayer carries dynamic power that shifts spiritual atmospheres and produces miraculous rain.",
    prayerPoints: [
      "Lord, anoint my tongue with the spirit of prevailing prayer and intercession.",
      "Let every spiritual drought and delay in my life break under the power of fervent prayer.",
      "Raise up an army of righteous intercessors in Light Up Prayer House across the nations."
    ],
    declaration: "My prayers are effective, fervent, and full of power. Through prayer, heavens are opened over my life!",
    bibleGatewayQuery: "James+5:13-18,1+Kings+18:41-46"
  },
  {
    day: 18,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "Clothed in the Whole Armor of God",
    scriptureReference: "Ephesians 6:10-18",
    keyVerse: "Ephesians 6:10-11",
    keyVerseText: "Finally, my brethren, be strong in the Lord, and in the power of his might. Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.",
    devotionalInsight: "We do not wrestle against flesh and blood, but against spiritual principalities. God has not left you defenseless; He has equipped you with truth, righteousness, peace, faith, salvation, the Word, and praying always in the Spirit.",
    prayerPoints: [
      "I put on the belt of truth, the breastplate of righteousness, and the helmet of salvation.",
      "I raise the shield of faith to quench every fiery dart of the enemy aimed at my mind and home.",
      "I wield the sword of the Spirit, which is the Word of God, against every demonic assault."
    ],
    declaration: "I am strong in the Lord and the power of His might. I am fully armored and completely victorious in Christ!",
    bibleGatewayQuery: "Ephesians+6:10-18"
  },
  {
    day: 19,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "Pulling Down Strongholds & Captive Thoughts",
    scriptureReference: "2 Corinthians 10:3-5, Isaiah 54:17",
    keyVerse: "2 Corinthians 10:4-5",
    keyVerseText: "For the weapons of our warfare are not carnal, but mighty through God to the pulling down of strong holds; Casting down imaginations, and every high thing that exalteth itself against the knowledge of God.",
    devotionalInsight: "Satan builds strongholds in the mind through lies, fear, and generational patterns. Our divine weapons—the Name of Jesus, the Blood of the Lamb, and the Word of God—have the power to demolish every high thing.",
    prayerPoints: [
      "I demolish every demonic stronghold and negative pattern operating in my family lineage.",
      "I cast down every fearful imagination, anxiety, and ungodly thought in the name of Jesus.",
      "I bring every thought in my mind into obedience to the lordship of Jesus Christ."
    ],
    declaration: "My weapons are mighty through God! Every generational curse and mental stronghold is broken forever.",
    bibleGatewayQuery: "2+Corinthians+10:3-5,Isaiah+54:17"
  },
  {
    day: 20,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "The Fortress of Divine Protection",
    scriptureReference: "Psalm 91:1-16",
    keyVerse: "Psalm 91:1-2",
    keyVerseText: "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.",
    devotionalInsight: "Those who dwell in God's presence are shielded from terror by night, arrows by day, pestilence, and destruction. Angels have been given charge over you to keep you in all your ways.",
    prayerPoints: [
      "Lord, I declare that You are my refuge, my fortress, and my infallible protector.",
      "Assign Your holy angels to guard me, my spouse, my children, and my loved ones everywhere we go.",
      "Deliver us from the snare of the fowler and from every noisome pestilence in Jesus' name."
    ],
    declaration: "No evil shall befall me, nor any plague come near my dwelling. Under His wings, I am secure and preserved!",
    bibleGatewayQuery: "Psalm+91:1-16"
  },
  {
    day: 21,
    week: 3,
    weekTitle: "Prayer, Spiritual Warfare & Breakthrough",
    theme: "The Mountain-Moving Prayer of Faith",
    scriptureReference: "Mark 11:22-24, Hebrews 11:1-6",
    keyVerse: "Mark 11:23-24",
    keyVerseText: "For verily I say unto you, That whosoever shall say unto this mountain, Be thou removed, and be thou cast into the sea; and shall not doubt in his heart... he shall have whatsoever he saith.",
    devotionalInsight: "Faith does not talk to God about how big the mountain is; faith talks to the mountain about how big our God is! Speak the Word of God with authority over financial blocks, sickness, and stagnation.",
    prayerPoints: [
      "Every mountain of delay, sickness, and limitation standing before my destiny, be removed into the sea!",
      "Increase my faith, Lord; eradicate every seed of hidden doubt in my heart.",
      "I receive by faith the fulfillment of all God has promised concerning my future."
    ],
    declaration: "I have mountain-moving faith! By the authority in Jesus' name, every obstacle is flattened before me.",
    bibleGatewayQuery: "Mark+11:22-24,Hebrews+11:1-6"
  },

  // ==================== WEEK 4: DIVINE RESTORATION, HEALING & DELIVERANCE ====================
  {
    day: 22,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "Restoring the Years the Locust Has Eaten",
    scriptureReference: "Joel 2:25-27, Zechariah 9:12",
    keyVerse: "Joel 2:25",
    keyVerseText: "And I will restore to you the years that the locust hath eaten, the cankerworm, and the caterpiller, and the palmerworm, my great army which I sent among you.",
    devotionalInsight: "God is a Master of restoration. No matter how much time, health, opportunities, or peace the enemy stole from you in past seasons, God has promised supernatural speed and double restoration for all your troubles.",
    prayerPoints: [
      "Father, restore unto me every wasted year, missed opportunity, and stolen blessing.",
      "Turn my mourning into dancing and clothe me with the garment of divine joy.",
      "Let double honor replace every former shame and reproach in my life."
    ],
    declaration: "The Lord is restoring all my wasted years! My future is far greater than my past, and I will never be ashamed.",
    bibleGatewayQuery: "Joel+2:25-27,Zechariah+9:12"
  },
  {
    day: 23,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "Healed & Whole by His Stripes",
    scriptureReference: "Isaiah 53:4-5, 1 Peter 2:24, Jeremiah 30:17",
    keyVerse: "1 Peter 2:24",
    keyVerseText: "Who his own self bare our sins in his own body on the tree, that we, being dead to sins, should live unto righteousness: by whose stripes ye were healed.",
    devotionalInsight: "Healing is not just a miracle; it is the children's bread. On the cross of Calvary, Jesus bore your griefs, carried your sorrows, and paid the full price for your physical, emotional, and spiritual wholeness.",
    prayerPoints: [
      "By the stripes of Jesus Christ, I decree total healing into my body, organs, blood, and bones.",
      "I rebuke every infirmity, chronic pain, and generational sickness in the name of Jesus.",
      "Lord, restore health unto me and heal my wounds as You have promised."
    ],
    declaration: "By the stripes of Jesus, I am healed and made whole! Divine health, vitality, and longevity are my portion.",
    bibleGatewayQuery: "Isaiah+53:4-5,1+Peter+2:24,Jeremiah+30:17"
  },
  {
    day: 24,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "Covenant Benefits & Renewed Youth",
    scriptureReference: "Psalm 103:1-5, Exodus 23:25-26",
    keyVerse: "Psalm 103:2-5",
    keyVerseText: "Bless the LORD, O my soul, and forget not all his benefits: Who forgiveth all thine iniquities; who healeth all thy diseases; Who redeemeth thy life from destruction... so that thy youth is renewed like the eagle's.",
    devotionalInsight: "Keep a fresh record of God's goodness. He forgives all sins, heals all diseases, redeems life from destruction, crowns you with lovingkindness, and renews your strength like the soaring eagle.",
    prayerPoints: [
      "Bless the Lord, O my soul! I thank You for all Your daily covenant benefits in my life.",
      "Renew my physical strength, mental sharpness, and spiritual zeal like the eagle's.",
      "Redeem my life and household from every destruction and trap of darkness."
    ],
    declaration: "I forget not God's benefits! My sins are forgiven, my body is healed, and my youth is renewed like the eagle's.",
    bibleGatewayQuery: "Psalm+103:1-5,Exodus+23:25-26"
  },
  {
    day: 25,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "Prophesying Life to Dry Bones",
    scriptureReference: "Ezekiel 37:1-14",
    keyVerse: "Ezekiel 37:4-5",
    keyVerseText: "Again he said unto me, Prophesy upon these bones, and say unto them, O ye dry bones, hear the word of the LORD. Thus saith the Lord GOD unto these bones; Behold, I will cause breath to enter into you, and ye shall live.",
    devotionalInsight: "No matter how dead, dry, or hopeless a circumstance looks, God's Word spoken through your mouth carries the breath of life. Speak the word of resurrection over dead dreams, barren businesses, and struggling relationships.",
    prayerPoints: [
      "Holy Spirit, breathe the breath of life into every dry bone and dying area of my destiny.",
      "I prophesy resurrection, alignment, and supernatural life into my finances, career, and family.",
      "Raise up an exceeding great army of testimonies in my household in Jesus' name."
    ],
    declaration: "The breath of God fills every dry area of my life! Dead dreams, lost hope, and stagnant projects are coming alive!",
    bibleGatewayQuery: "Ezekiel+37:1-14"
  },
  {
    day: 26,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "Supernatural Signs & Miraculous Deliverance",
    scriptureReference: "Mark 16:15-20, Luke 10:19",
    keyVerse: "Mark 16:17-18",
    keyVerseText: "And these signs shall follow them that believe; In my name shall they cast out devils; they shall speak with new tongues... they shall lay hands on the sick, and they shall recover.",
    devotionalInsight: "You are not an ordinary believer; signs and wonders are ordained to follow your faith in Jesus' name. God has given you authority over all the power of the enemy, and nothing shall by any means hurt you.",
    prayerPoints: [
      "Lord, confirm Your Word in my life with signs, wonders, and supernatural deliverances.",
      "I exercise authority in Jesus' name over every demonic oppression, fear, and harassment.",
      "Make me a conduit of Christ's healing and deliverance to hurting souls around me."
    ],
    declaration: "Miracles, signs, and wonders follow me because I believe in the mighty name of Jesus Christ!",
    bibleGatewayQuery: "Mark+16:15-20,Luke+10:19"
  },
  {
    day: 27,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "Soaring on Eagle's Wings",
    scriptureReference: "Isaiah 40:28-31, Psalm 29:11",
    keyVerse: "Isaiah 40:31",
    keyVerseText: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    devotionalInsight: "Waiting upon the Lord is not passive idling; it is active spiritual expectation and deep prayer. As you tarry in His presence, your human fatigue is swapped for divine endurance so you can soar above every storm.",
    prayerPoints: [
      "Lord, as I wait on You, exchange my weakness for Your supernatural strength.",
      "Grant me grace to mount up on eagle's wings above every storm and economic turbulence.",
      "Deliver me from burnout, weariness, and fainting in the race of life."
    ],
    declaration: "I wait upon the Lord and my strength is renewed. I run and am not weary; I walk and do not faint!",
    bibleGatewayQuery: "Isaiah+40:28-31,Psalm+29:11"
  },
  {
    day: 28,
    week: 4,
    weekTitle: "Divine Restoration, Healing & Deliverance",
    theme: "More Than Conquerors in Christ",
    scriptureReference: "Romans 8:28-39",
    keyVerse: "Romans 8:31, 37",
    keyVerseText: "What shall we then say to these things? If God be for us, who can be against us?... Nay, in all these things we are more than conquerors through him that loved us.",
    devotionalInsight: "Nothing in all creation—neither tribulation, distress, persecution, famine, death, nor demonic powers—can separate you from the love of God in Christ Jesus. You don't fight for victory; you fight from Christ's completed victory!",
    prayerPoints: [
      "Father, I thank You that all things are working together for my good because I love You.",
      "I silence every accusing voice of the enemy; if God is for me, no weapon formed against me shall prosper.",
      "Root my soul deeply in Your unfailing, unbreakable love."
    ],
    declaration: "If God is for me, who can be against me? In all these things, I am more than a conqueror through Christ Jesus!",
    bibleGatewayQuery: "Romans+8:28-39"
  },

  // ==================== DAYS 29–30: COVENANT PRAISE & TOTAL VICTORY ====================
  {
    day: 29,
    week: 5,
    weekTitle: "Covenant Praise & Walking in Total Victory",
    theme: "High Praise and Entering His Gates",
    scriptureReference: "Psalm 100:1-5, Psalm 149:1-9, Psalm 150:1-6",
    keyVerse: "Psalm 100:4-5",
    keyVerseText: "Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name. For the LORD is good; his mercy is everlasting; and his truth endureth to all generations.",
    devotionalInsight: "Praise is a supernatural spiritual weapon. When Paul and Silas sang praises at midnight, the earth shook and prison doors flew open. When high praises of God are in our mouth, chains break and generational blessings are established.",
    prayerPoints: [
      "I enter Your gates today with profound thanksgiving and Your courts with exuberant praise!",
      "Let the high praises of God in my mouth break every remaining chain and prison door.",
      "Thank You, Lord, for Your everlasting mercy, goodness, and faithfulness over my life."
    ],
    declaration: "The Lord is good and His mercy endures forever! My mouth is filled with continuous praise and triumph.",
    bibleGatewayQuery: "Psalm+100:1-5,Psalm+149:1-9,Psalm+150:1-6"
  },
  {
    day: 30,
    week: 5,
    weekTitle: "Covenant Praise & Walking in Total Victory",
    theme: "Overcoming by the Blood and the Testimony",
    scriptureReference: "Revelation 12:11, 1 Corinthians 15:57-58, 2 Corinthians 2:14",
    keyVerse: "Revelation 12:11",
    keyVerseText: "And they overcame him by the blood of the Lamb, and by the word of their testimony; and they loved not their lives unto the death.",
    devotionalInsight: "Congratulations on completing your 30-Day Scripture Journey! You are an overcomer through the shed blood of Jesus and your bold faith declarations. Continue walking steadfast, unmovable, and always abounding in the work of the Lord.",
    prayerPoints: [
      "I plead the blood of Jesus over every revelation, breakthrough, and blessing received in this 30-day journey.",
      "Father, keep me steadfast, unshakeable, and fiery in my prayer life and Word study forever.",
      "Thank You for giving me total, unending victory through our Lord Jesus Christ!"
    ],
    declaration: "I am an overcomer by the blood of the Lamb and the word of my testimony. Thanks be to God who always leads me in triumph!",
    bibleGatewayQuery: "Revelation+12:11,1+Corinthians+15:57-58,2+Corinthians+2:14"
  }
];

const LOCAL_STORAGE_KEY = 'lightup_scripture_reading_progress_v1';

export function getLocalReadingPlanProgress(): ReadingPlanProgress {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completedDays: Array.isArray(parsed.completedDays) ? parsed.completedDays : [],
        notes: parsed.notes || {},
        startDate: parsed.startDate || new Date().toISOString(),
        lastActiveDate: parsed.lastActiveDate || new Date().toISOString(),
        streak: typeof parsed.streak === 'number' ? parsed.streak : (parsed.completedDays?.length || 0)
      };
    }
  } catch (err) {
    console.error('Error reading local progress:', err);
  }

  const initial: ReadingPlanProgress = {
    completedDays: [],
    notes: {},
    startDate: new Date().toISOString(),
    lastActiveDate: new Date().toISOString(),
    streak: 0
  };
  return initial;
}

export function saveLocalReadingPlanProgress(progress: ReadingPlanProgress): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Error saving local progress:', err);
  }
}

/**
 * Syncs user reading progress with Firestore if authenticated
 */
export async function syncUserReadingProgress(userId: string, progress: ReadingPlanProgress): Promise<void> {
  if (!userId) return;
  try {
    const docRef = doc(db, 'users', userId, 'reading_plan', '30_days_journey');
    await setDoc(docRef, {
      ...progress,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore sync error for reading plan:', err);
  }
}

/**
 * Loads user reading progress from Firestore if available
 */
export async function loadUserReadingProgress(userId: string): Promise<ReadingPlanProgress | null> {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'reading_plan', '30_days_journey');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        completedDays: data.completedDays || [],
        notes: data.notes || {},
        startDate: data.startDate || new Date().toISOString(),
        lastActiveDate: data.lastActiveDate || new Date().toISOString(),
        streak: data.streak || 0
      };
    }
  } catch (err) {
    console.warn('Firestore load error for reading plan:', err);
  }
  return null;
}
