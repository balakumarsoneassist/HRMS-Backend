const fs = require('fs');
const mime = require('mime-types');
const { ToWords } = require('to-words');
const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
    } 
  });
module.exports={
    date:(date)=>{
        try{
            return new Date(date).toLocaleString('en-IN',{ 
                dateStyle:'medium'
            });
        }
        catch(error){
            throw error;
        }
    },
    currency:(value)=>{
        try{
            return Number(value).toLocaleString('en-IN',{
                maximumFractionDigits: 2,
                style: 'currency',
                currency: 'INR'
            });
        }
        catch(error){
            throw error;
        }
    },
    base64:(file)=>{
        try{
            let contentType=mime.contentType(file);
            let string =`data:${contentType};base64,`+ new Buffer.from(fs.readFileSync(file)).toString('base64');
            return string
        }
        catch(error){
            throw error;
        }
    },
    toWords:(value)=>{
        try{
            return toWords.convert(value)
        }
        catch(error){
            throw error;
        }
    }
}



