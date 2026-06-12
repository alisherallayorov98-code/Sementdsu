import { useData } from '../context/DataContext';
import BalancePage from './BalancePage';

function BankBal({ lang }) {
  return <BalancePage lang={lang} type="bank" title="Bank qoldig'i" color="#0d47a1" />;
}
export default BankBal;
