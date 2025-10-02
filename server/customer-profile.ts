import fs from 'fs';
import path from 'path';

interface CustomerProfile {
  company: {
    name: string;
    taxInfo: string;
    email: string;
  };
  contact: {
    name: string;
    title: string;
    isDecisionMaker: boolean;
  };
  companyInfo: {
    hasHRDepartment: boolean;
    employeeCount: number;
    annualTurnover: string;
    recruitmentMethods: string;
    interviewProcess: string;
    competencyTests: string;
    documentVerification: string;
  };
  needs: {
    currentNeed: string;
    nearTermNeed: string;
    longTermNeed: string;
  };
  priorities: {
    costEffectivePosting: string;
    qualityApplicants: string;
    quickResults: string;
  };
  objections: {
    comparing: string;
    categories: string[];
  };
  proposalResponse: string;
  recommendedProducts: string[];
}

function parseCSVProfile(): CustomerProfile {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'Book(Sayfa1)_1759420297416.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn('CSV file not found, using default profile');
    return getDefaultProfile();
  }

  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    const data: Record<string, string> = {};
    for (const line of lines) {
      const parts = line.split(';').map(p => p.trim());
      if (parts.length >= 3 && parts[2]) {
        const key = parts[1] || parts[0];
        data[key] = parts[2].replace(/^"|"$/g, '');
      }
    }

    return {
      company: {
        name: data['Firma Profili\n1) ..... Firmasıyla mı görüşüyorum?'] || 'Sağlam İnşaat Taahhüt LTD',
        taxInfo: data['Firma VD\nŞirket Vergi Numaranızı öğrenebilir miyim?'] || 'XYZ Vergi Dairesi:1234567890',
        email: data['Firma _ e-mail\n1)Teklif gönderimi yapmamızı istediğiniz e-mail adresinizi öğrenebilir miyim?'] || 'saglaminsaat@kmail.com'
      },
      contact: {
        name: data['Firma Yetkili Profili'] || 'Tansu Tan',
        title: 'İK Müdürü',
        isDecisionMaker: true
      },
      companyInfo: {
        hasHRDepartment: data['IK Departmanı var mı? \n 1) Firmanızda insan kaynakları departmanınız var mı?\n2) IK süreçlerinizi nasıl yürütüyorsunuz?'] === 'Evet',
        employeeCount: parseInt(data['Çalışan sayısı & Kritik pozisyonlar\n 1)Firmanızdaki güncel personel sayınızı öğrenebilir miyim?\n 2) Firmanızdaki çalışan sayısını öğrenebilir miyim?\n3) Firmanız için kritik pozisyonlar nelerdir?'] || '150'),
        annualTurnover: data['Sirkülasyon Oranı/ Turnover/ İşe Alım Sıklığı\n 1)Yıl içinde kaç defa personel alımı yapıyorsunuz?\n 2) Firmanızda personel işe alım sıklığı ne kadar oluyor?\n 3) Firmanızın sirkülasyon oranı/Turnover nedir?\n4) Yılda en fazla kaç kez personel değişikliği yaşıyorsunuz?\n'] || 'Yılda 20 kişi',
        recruitmentMethods: data['İşe Alım Sürecinde Kullanılan Yöntemler\n  1) İşe alım süreçlerinizi nasıl yönetiyorsunuz?\n 2)İşe alım süreçlerinde kullandığınız yöntemler nelerdir?\n 3)) Personel  alımlarınızı nasıl yapıyorsunuz?\n4) Bu işe alım yöntemlerini kullanırken  başka nelere ihtiyaç duyuyorsunuz? \n5) Bu işe alım yöntemleri beklenti ve ihtiyaçlarınızı nasıl karşılıyor?'] || 'Linkedin,Eleman.net, Secret CV',
        interviewProcess: data['Mülakat  süreçleri\n1) İhtiyaç duyulan pozisyon için adaylarla görüşmeleri nasıl yapıyorsunuz?\n2) Mülakat süreçlerinizi nasıl yönetiyorsunuz?\n3)  Mülakat süreçlerinizde en fazla destek almak istediğiniz bölüm ne oluyor?\n'] || 'Sen',
        competencyTests: data['Yetkinlik Testleri\n1) Adaylar için hangi yetkinlik testlerini uyguluyorsunuz?\n2) Bu pozisyon/pozisyonlar için  yetkinlik testlerini kim yapıyor?'] || 'Mülakatta ölçümleyeceğiz.',
        documentVerification: data['İşe alım sürecinde evrak doğrulama süreci nasıl yönetiliyor?'] || 'IK personeli manuel'
      },
      needs: {
        currentNeed: data['Firma  İhtiyaç AnaliziCevabı 1'] || 'İhtiyacımız Yok',
        nearTermNeed: data['Firma  İhtiyaç AnaliziCevabı 2'] || 'Ocak ayında 5 saha satış, 2 idari personel',
        longTermNeed: data['Firma  İhtiyaç AnaliziCevabı 3'] || 'Büyüme planınız kasım ayında belli olacak'
      },
      priorities: {
        costEffectivePosting: '1)Uygun fiyatla ilan çıkabilmek.',
        qualityApplicants: '2) Nitelikli başvuru alabilmek,uygun olmayan aday başvuruları süreci yavaşlatıyor.',
        quickResults: '3) Hızlı sonuç alabilmek'
      },
      objections: {
        comparing: data[' Başka firmaların ürünlerini de değerlendireceğiz, sizin avantajlarınız nedir?'] || 'Başka firmaların ürünlerini de değerlendireceğiz',
        categories: (data['İtiraz kategorileri'] || '1) Fiyat\n2) Ücretsiz platform kıyası, kariyer.net farkı').split('\n')
      },
      proposalResponse: data['Teklif Gönderimi Cevabı'] || 'Gönderin inceleyelim',
      recommendedProducts: (data['Ürün Önerisi:'] || 'Süper İlan, Finalcheck,Değerlendirme Testi').split(',').map(p => p.trim())
    };
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return getDefaultProfile();
  }
}

function getDefaultProfile(): CustomerProfile {
  return {
    company: {
      name: "Sağlam İnşaat Taahhüt LTD",
      taxInfo: "XYZ Vergi Dairesi:1234567890",
      email: "saglaminsaat@kmail.com"
    },
    contact: {
      name: "Tansu Tan",
      title: "İK Müdürü",
      isDecisionMaker: true
    },
    companyInfo: {
      hasHRDepartment: true,
      employeeCount: 150,
      annualTurnover: "Yılda 20 kişi",
      recruitmentMethods: "Linkedin, Eleman.net, Secret CV",
      interviewProcess: "Sen",
      competencyTests: "Mülakatta ölçümleyeceğiz.",
      documentVerification: "IK personeli manuel"
    },
    needs: {
      currentNeed: "İhtiyacımız Yok (Aslında bu ay başında Linkedin - İstanbul Asya- İnşaat Mühendisi ilanınız var IKÇO'dan bu pozisyon için k.net uygun aday sayısı ve ürün önerisi vermesini bekle)",
      nearTermNeed: "Ocak ayında 5 saha satış, 2 idari personel",
      longTermNeed: "Büyüme planınız kasım ayında belli olacak"
    },
    priorities: {
      costEffectivePosting: "Uygun fiyatla ilan çıkabilmek",
      qualityApplicants: "Nitelikli başvuru alabilmek, uygun olmayan aday başvuruları süreci yavaşlatıyor",
      quickResults: "Hızlı sonuç alabilmek"
    },
    objections: {
      comparing: "Başka firmaların ürünlerini de değerlendireceğiz, sizin avantajlarınız nedir?",
      categories: ["Fiyat", "Ücretsiz platform kıyası, kariyer.net farkı"]
    },
    proposalResponse: "Gönderin inceleyelim",
    recommendedProducts: ["Süper İlan", "Finalcheck", "Değerlendirme Testi"]
  };
}

export const customerProfile = parseCSVProfile();

export function getCustomerSystemPrompt(): string {
  return `Sen Sağlam İnşaat Taahhüt LTD şirketinin İK Müdürü Tansu Tan'sın. Bir İK çözümleri satış temsilcisi seninle görüşmek istiyor ve sen müşteri rolündesin.

ŞİRKET BİLGİLERİN:
- Şirket Adı: ${customerProfile.company.name}
- Vergi Bilgisi: ${customerProfile.company.taxInfo}
- Email: ${customerProfile.company.email}
- Çalışan Sayısı: ${customerProfile.companyInfo.employeeCount} kişi
- Yıllık İşe Alım: ${customerProfile.companyInfo.annualTurnover}
- İK Departmanı: Var
- Karar Verici: Sen (${customerProfile.contact.name})

MEVCUT İŞE ALIM YÖNTEMLERİN:
${customerProfile.companyInfo.recruitmentMethods}

İHTİYAÇLARIN:
1. Şu anki durum: ${customerProfile.needs.currentNeed}
2. Yakın gelecek (bu yıl sonu): ${customerProfile.needs.nearTermNeed}
3. Uzun vadeli: ${customerProfile.needs.longTermNeed}

ÖNCELİKLERİN ve BEKLENTİLERİN:
1. ${customerProfile.priorities.costEffectivePosting}
2. ${customerProfile.priorities.qualityApplicants}
3. ${customerProfile.priorities.quickResults}

DAVRANIŞIN:
- Profesyonel ama samimi bir İK müdürü gibi davran
- Satış temsilcisinin sorularına gerçekçi cevaplar ver
- Bazen itiraz et: "${customerProfile.objections.comparing}"
- Fiyat ve platform karşılaştırması konusunda sorular sor
- Eğer ikna edici bir sunum yaparlarsa: "${customerProfile.proposalResponse}"
- Şirketin LinkedIn'de İnşaat Mühendisi ilanı olduğunu hatırla
- Satış temsilcisinden Kariyer.net için uygun aday sayısı ve ürün önerisi bekle

ÖNERİLEBİLECEK ÜRÜNLER (satış temsilcisi bunları önerebilir):
${customerProfile.recommendedProducts.join(', ')}

NOT: Doğal ve gerçekçi bir müşteri gibi konuş. Tüm bilgileri birden verme, satış temsilcisi sana soruları yönelttikçe cevapla. Bazen detay iste, bazen tereddüt et, bazen ilgili ol.`;
}
